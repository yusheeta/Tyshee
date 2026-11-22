// Package migrations holds the ordered SQL schema files.
package migrations

import "embed"

// FS contains every NNNN_name.sql file, applied in lexical order.
//
//go:embed *.sql
var FS embed.FS
