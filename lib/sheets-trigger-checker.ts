/**
 * Google Sheets Trigger Checker
 * Checks sheet data against trigger conditions using Service Account.
 */
import { saReadCell, saReadSheet } from "@/lib/google-sheets-sa"

export interface SheetsTriggerState {
  lastCellValue?: string          // sheets_cell_changed
  lastProcessedRow?: number       // sheets_new_row_*
}

export interface SheetsTriggerResult {
  fired: boolean
  reason: string
  newState: SheetsTriggerState
  rows?: Record<string, string>[]  // new rows data (for new_row events)
  cellValue?: string
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

function evalCondition(cellValue: string, condition: string, target: string): boolean {
  const v = cellValue.trim().toLowerCase()
  const t = (target ?? "").trim().toLowerCase()
  switch (condition) {
    case "equals":        return v === t
    case "not_equals":    return v !== t
    case "not_empty":     return v !== ""
    case "is_empty":      return v === ""
    case "contains":      return v.includes(t)
    case "starts_with":   return v.startsWith(t)
    case "ends_with":     return v.endsWith(t)
    case "greater_than":  return parseFloat(cellValue) > parseFloat(target)
    case "less_than":     return parseFloat(cellValue) < parseFloat(target)
    case "gte":           return parseFloat(cellValue) >= parseFloat(target)
    case "lte":           return parseFloat(cellValue) <= parseFloat(target)
    default:              return false
  }
}

// ─── 1. Cell Value Changed ────────────────────────────────────────────────────

export async function checkSheetsCellChanged(
  triggerConfig: any,
  state: SheetsTriggerState
): Promise<SheetsTriggerResult> {
  const spreadsheetId = triggerConfig.sheetsSpreadsheetId
  const sheetName     = triggerConfig.sheetsSheetName   ?? "Sheet1"
  const triggerCell   = triggerConfig.sheetsTriggerCell ?? "A1"
  const condition     = triggerConfig.sheetsCondition   ?? "equals"
  const targetValue   = triggerConfig.sheetsConditionValue ?? ""

  if (!spreadsheetId) {
    return { fired: false, reason: "No spreadsheet configured", newState: state }
  }

  const currentValue = await saReadCell(spreadsheetId, sheetName, triggerCell)
  const conditionMet = evalCondition(currentValue, condition, targetValue)

  const newState: SheetsTriggerState = { ...state, lastCellValue: currentValue }

  if (!conditionMet) {
    return {
      fired: false,
      reason: `Cell ${triggerCell} = "${currentValue}" — condition not met (${condition} "${targetValue}")`,
      newState,
      cellValue: currentValue,
    }
  }

  // Only fire if value actually changed (or no previous state)
  if (state.lastCellValue !== undefined && state.lastCellValue === currentValue) {
    return {
      fired: false,
      reason: `Cell ${triggerCell} = "${currentValue}" — condition met but value unchanged`,
      newState,
      cellValue: currentValue,
    }
  }

  return {
    fired: true,
    reason: `Cell ${triggerCell} changed to "${currentValue}" — condition ${condition} "${targetValue}" met`,
    newState,
    cellValue: currentValue,
  }
}

// ─── 2. New Rows to Launch ────────────────────────────────────────────────────

export async function checkSheetsNewRows(
  triggerConfig: any,
  state: SheetsTriggerState
): Promise<SheetsTriggerResult> {
  const spreadsheetId  = triggerConfig.sheetsSpreadsheetId
  const sheetName      = triggerConfig.sheetsSheetName    ?? "Sheet1"
  const headerRow      = (triggerConfig.sheetsHeaderRow   ?? 1) - 1  // 0-indexed
  const dataStartRow   = (triggerConfig.sheetsDataStartRow ?? 2) - 1 // 0-indexed

  if (!spreadsheetId) {
    return { fired: false, reason: "No spreadsheet configured", newState: state }
  }

  const { headers, rows } = await saReadSheet(spreadsheetId, sheetName)

  if (rows.length === 0) {
    return { fired: false, reason: "No rows in sheet", newState: state }
  }

  const lastProcessed = state.lastProcessedRow ?? 0

  // First run: mark all existing rows as processed but don't fire
  if (lastProcessed === 0 && !(triggerConfig.sheetsProcessExistingRows)) {
    const newState: SheetsTriggerState = { ...state, lastProcessedRow: rows.length }
    return {
      fired: false,
      reason: `First run — recorded ${rows.length} existing row(s), will trigger on new rows only`,
      newState,
    }
  }

  // Find new rows since last processed
  const newRows = rows.slice(lastProcessed)

  if (newRows.length === 0) {
    return {
      fired: false,
      reason: `No new rows (last processed: row ${lastProcessed + dataStartRow + 1})`,
      newState: state,
    }
  }

  // Convert rows to objects using headers
  const rowObjects = newRows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h || `col_${i}`, row[i] ?? ""]))
  )

  const newState: SheetsTriggerState = { ...state, lastProcessedRow: rows.length }

  return {
    fired: true,
    reason: `${newRows.length} new row(s) found (rows ${lastProcessed + dataStartRow + 1}–${rows.length + dataStartRow})`,
    newState,
    rows: rowObjects,
  }
}
