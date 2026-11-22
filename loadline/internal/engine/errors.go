package engine

import (
	"errors"
	"fmt"
)

// Error is a business outcome the caller can act on. It maps to an HTTP
// problem+json response, and because it is deterministic it is stored on the
// idempotency key and replayed to retries (I4). Infrastructure errors are not
// Errors: they roll the transaction back and leave nothing stored.
type Error struct {
	Status int    `json:"status"`
	Code   string `json:"code"`
	Detail string `json:"detail"`
	// For budget_exceeded and node_frozen: the node that blocked the request.
	NodeID         int64  `json:"node_id,omitempty"`
	HeadroomMicros *int64 `json:"headroom_micros,omitempty"`
}

func (e *Error) Error() string { return fmt.Sprintf("%s (%d): %s", e.Code, e.Status, e.Detail) }

// Error codes.
const (
	CodeBudgetExceeded      = "budget_exceeded"
	CodeNodeFrozen          = "node_frozen"
	CodeNotFound            = "not_found"
	CodeInvalidState        = "invalid_state"
	CodeAmountMismatch      = "settle_amount_mismatch"
	CodeExpired             = "reservation_expired"
	CodeIdempotencyMismatch = "idempotency_key_reused"
	CodeValidation          = "validation_failed"
)

// AsError extracts an *Error from err.
func AsError(err error) (*Error, bool) {
	var e *Error
	ok := errors.As(err, &e)
	return e, ok
}

// IsCode reports whether err is an *Error with the given code.
func IsCode(err error, code string) bool {
	e, ok := AsError(err)
	return ok && e.Code == code
}

func validation(format string, a ...any) *Error {
	return &Error{Status: 422, Code: CodeValidation, Detail: fmt.Sprintf(format, a...)}
}

func notFound(what string, id int64) *Error {
	return &Error{Status: 404, Code: CodeNotFound, Detail: fmt.Sprintf("%s %d not found", what, id)}
}

func invalidState(id int64, s State, op string) *Error {
	return &Error{Status: 409, Code: CodeInvalidState,
		Detail: fmt.Sprintf("reservation %d is %s and cannot be %s", id, s, op)}
}

func budgetExceeded(nodeID, headroom, amount int64) *Error {
	h := headroom
	return &Error{Status: 402, Code: CodeBudgetExceeded, NodeID: nodeID, HeadroomMicros: &h,
		Detail: fmt.Sprintf("node %d has %d micro-credits of headroom; %d requested", nodeID, headroom, amount)}
}

func nodeFrozen(nodeID int64) *Error {
	return &Error{Status: 402, Code: CodeNodeFrozen, NodeID: nodeID,
		Detail: fmt.Sprintf("node %d is frozen after an overrun until its period resets or it is topped up", nodeID)}
}

// errPeriodMissing is internal: a node on the path has no balance row for
// the current period yet. The caller opens the period in its own short
// transaction and retries.
var errPeriodMissing = errors.New("engine: balance period not open")
