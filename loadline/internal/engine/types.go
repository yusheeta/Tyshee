// Package engine is Loadline's money engine: the budget tree, reservations
// and their state machine, idempotency, and the double-entry ledger. Every
// function that moves money runs inside one short Postgres transaction and
// locks rows in one global order (reservation first, then node balances by
// ascending node_id), so concurrent requests can neither deadlock nor
// over-admit. See docs/transactions.md.
package engine

import "time"

// Period is how often a node's budget resets.
type Period string

const (
	Daily   Period = "daily"
	Monthly Period = "monthly"
	None    Period = "none"
)

// Valid reports whether p is a known period.
func (p Period) Valid() bool { return p == Daily || p == Monthly || p == None }

// Start returns the start of the period containing t, in UTC. Periods are
// computed from the database clock, never an application server's.
func (p Period) Start(t time.Time) time.Time {
	t = t.UTC()
	switch p {
	case Daily:
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	case Monthly:
		return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
	default:
		return time.Unix(0, 0).UTC()
	}
}

// MaxDepth is the deepest a budget tree may go (org, project, agent, ...).
const MaxDepth = 4

// Node is one budget in a tenant's tree.
type Node struct {
	ID              int64     `json:"id"`
	TenantID        int64     `json:"tenant_id"`
	ParentID        *int64    `json:"parent_id,omitempty"`
	Name            string    `json:"name"`
	Depth           int       `json:"depth"`
	AncestorIDs     []int64   `json:"ancestor_ids"`
	Period          Period    `json:"period"`
	LimitMicros     int64     `json:"limit_micros"`
	OverdraftMicros int64     `json:"overdraft_micros"`
	CreatedAt       time.Time `json:"created_at"`
}

// Balance is a node's state for one period.
type Balance struct {
	NodeID      int64     `json:"node_id"`
	PeriodStart time.Time `json:"period_start"`
	Allocated   int64     `json:"allocated"`
	Overdraft   int64     `json:"overdraft"`
	Held        int64     `json:"held"`
	Consumed    int64     `json:"consumed"`
	Overrun     int64     `json:"overrun"`
	Frozen      bool      `json:"frozen"`
}

// Headroom is how much more can be held on this node right now.
func (b Balance) Headroom() int64 { return b.Allocated + b.Overdraft - b.Held - b.Consumed }

// State is a reservation's lifecycle state.
type State string

const (
	Held     State = "HELD"
	Settled  State = "SETTLED"
	Released State = "RELEASED"
	Expired  State = "EXPIRED"
)

// Hold is the part of a reservation held on one node of the path.
type Hold struct {
	NodeID      int64     `json:"node_id"`
	PeriodStart time.Time `json:"period_start"`
	Amount      int64     `json:"amount"`
}

// Reservation is a hold on every node from a leaf to the root.
type Reservation struct {
	ID            int64     `json:"id"`
	TenantID      int64     `json:"tenant_id"`
	LeafNodeID    int64     `json:"leaf_node_id"`
	Amount        int64     `json:"amount"`
	State         State     `json:"state"`
	ExpiresAt     time.Time `json:"expires_at"`
	MaxExpiresAt  time.Time `json:"max_expires_at"`
	SettledAmount *int64    `json:"settled_amount,omitempty"`
	// LateSettledAmount is set when a settle arrived after expiry.
	LateSettledAmount *int64    `json:"late_settled_amount,omitempty"`
	Holds             []Hold    `json:"holds"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// Reservation timing limits.
const (
	DefaultTTL  = 60 * time.Second
	MaxTTL      = 15 * time.Minute
	MaxLifetime = 1 * time.Hour // extend can never push expiry past created_at + this
)
