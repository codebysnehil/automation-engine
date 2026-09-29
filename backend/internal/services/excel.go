package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

type ParsedColumn struct {
	Name     string
	DataType string // string | number | boolean | date
}

type ParsedSheet struct {
	SheetName string
	Columns   []ParsedColumn
	Rows      []map[string]any
}

// ParseTabular parses an .xlsx/.xlsm or .csv file into a structured sheet:
// header row becomes column names, column types are inferred by sampling,
// and cell values are converted to typed JSON values.
func ParseTabular(r io.Reader, filename string) (*ParsedSheet, error) {
	lower := strings.ToLower(filename)
	if strings.HasSuffix(lower, ".csv") || strings.HasSuffix(lower, ".tsv") {
		return parseCSV(r, strings.HasSuffix(lower, ".tsv"))
	}
	return parseExcel(r)
}

func parseExcel(r io.Reader) (*ParsedSheet, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, fmt.Errorf("could not open Excel file: %w", err)
	}
	defer f.Close()

	var sheetName string
	var raw [][]string
	for _, name := range f.GetSheetList() {
		rows, err := f.GetRows(name)
		if err != nil {
			continue
		}
		if len(rows) > 0 {
			sheetName = name
			raw = rows
			break
		}
	}
	if sheetName == "" {
		return nil, fmt.Errorf("workbook contains no non-empty sheets")
	}
	return buildSheet(sheetName, raw)
}

func parseCSV(r io.Reader, tab bool) (*ParsedSheet, error) {
	reader := csv.NewReader(r)
	if tab {
		reader.Comma = '\t'
	}
	reader.FieldsPerRecord = -1
	raw, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("could not parse CSV: %w", err)
	}
	return buildSheet("csv", raw)
}

func buildSheet(sheetName string, raw [][]string) (*ParsedSheet, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("sheet is empty")
	}
	headers := cleanHeaders(raw[0])
	dataRows := raw[1:]

	types := inferColumnTypes(headers, dataRows)
	columns := make([]ParsedColumn, len(headers))
	for i, h := range headers {
		columns[i] = ParsedColumn{Name: h, DataType: types[i]}
	}

	rows := make([]map[string]any, 0, len(dataRows))
	for _, rawRow := range dataRows {
		if isEmptyRow(rawRow) {
			continue
		}
		row := make(map[string]any, len(headers))
		for i, h := range headers {
			var cell string
			if i < len(rawRow) {
				cell = strings.TrimSpace(rawRow[i])
			}
			row[h] = convertCell(cell, types[i])
		}
		rows = append(rows, row)
	}

	return &ParsedSheet{SheetName: sheetName, Columns: columns, Rows: rows}, nil
}

func cleanHeaders(raw []string) []string {
	headers := make([]string, len(raw))
	seen := map[string]int{}
	for i, h := range raw {
		name := strings.TrimSpace(h)
		if name == "" {
			name = fmt.Sprintf("column_%d", i+1)
		}
		if count, dup := seen[name]; dup {
			seen[name] = count + 1
			name = fmt.Sprintf("%s_%d", name, count+1)
		}
		seen[name] = 1
		headers[i] = name
	}
	return headers
}

func isEmptyRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

// inferColumnTypes samples up to 200 rows per column. A column gets a
// non-string type only when every non-empty sample matches that type.
func inferColumnTypes(headers []string, rows [][]string) []string {
	const sampleLimit = 200
	types := make([]string, len(headers))
	for col := range headers {
		isNumber, isBool, isDate := true, true, true
		nonEmpty := 0
		for r := 0; r < len(rows) && r < sampleLimit; r++ {
			var cell string
			if col < len(rows[r]) {
				cell = strings.TrimSpace(rows[r][col])
			}
			if cell == "" {
				continue
			}
			nonEmpty++
			if _, err := strconv.ParseFloat(cell, 64); err != nil {
				isNumber = false
			}
			if !isBoolString(cell) {
				isBool = false
			}
			if !isDateString(cell) {
				isDate = false
			}
		}
		switch {
		case nonEmpty == 0:
			types[col] = "string"
		case isBool:
			types[col] = "boolean"
		case isNumber:
			types[col] = "number"
		case isDate:
			types[col] = "date"
		default:
			types[col] = "string"
		}
	}
	return types
}

func isBoolString(s string) bool {
	switch strings.ToLower(s) {
	case "true", "false", "yes", "no":
		return true
	}
	return false
}

var dateLayouts = []string{
	"2006-01-02", "01/02/2006", "02/01/2006", "1/2/2006",
	"2006-01-02 15:04:05", "01-02-06", "2-Jan-06", "Jan 2, 2006",
	time.RFC3339,
}

func isDateString(s string) bool {
	for _, layout := range dateLayouts {
		if _, err := time.Parse(layout, s); err == nil {
			return true
		}
	}
	return false
}

func convertCell(cell, dataType string) any {
	if cell == "" {
		return nil
	}
	switch dataType {
	case "number":
		if v, err := strconv.ParseFloat(cell, 64); err == nil {
			return v
		}
	case "boolean":
		switch strings.ToLower(cell) {
		case "true", "yes":
			return true
		case "false", "no":
			return false
		}
	}
	return cell
}
