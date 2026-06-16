import { ChevronDown, Eye, Minus, MousePointer2, Plus, Search } from "lucide-react";

import {
  buildCellStyle,
  getCellAddress,
  getCellText,
  getColumnWidth,
  getRowHeight,
} from "./mappingPage.parts.jsx";

const MappingPreviewPanel = ({
  selectedSheetName,
  sheetNames,
  zoom,
  isReadOnly,
  currentMappingType,
  loading,
  preview,
  zoomStyle,
  gridWidth,
  previewColumns,
  previewRows,
  onSheetChange,
  onZoomOut,
  onZoomReset,
  onZoomIn,
  onCellClick,
  isCellMapped,
  isRepeatStartCell,
}) => (
  <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
      <div className="flex items-center gap-2">
        <Eye size={18} className="text-slate-500" />
        <div className="font-black text-slate-950">엑셀 미리보기</div>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <div className="relative">
          <select
            value={selectedSheetName}
            onChange={onSheetChange}
            className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-black text-slate-800 outline-none lg:min-w-[140px]"
          >
            {sheetNames.length === 0 && <option value="">Sheet1</option>}
            {sheetNames.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        <div className="flex h-11 w-full items-center justify-center rounded-2xl bg-slate-100 px-2 lg:w-auto">
          <button type="button" onClick={onZoomOut} className="rounded-xl p-2 text-slate-600 hover:bg-white">
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            className="min-w-[64px] rounded-xl px-3 py-2 text-sm font-black text-slate-800 hover:bg-white"
          >
            {zoom}%
          </button>
          <button type="button" onClick={onZoomIn} className="rounded-xl p-2 text-slate-600 hover:bg-white">
            <Plus size={16} />
          </button>
        </div>

        <div className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700 lg:w-auto">
          <MousePointer2 size={16} />
          {isReadOnly ? "확인 전용" : currentMappingType === "SINGLE_CELL" ? "단일 셀" : "반복 컬럼"}
        </div>
      </div>
    </div>

    <div className="min-h-[520px] overflow-auto p-2 sm:p-4 lg:min-h-[720px] lg:p-5">
      {loading && (
        <div className="flex h-[340px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-bold text-slate-500 lg:h-[500px]">
          엑셀 미리보기를 불러오는 중입니다.
        </div>
      )}

      {!loading && !preview && (
        <div className="flex h-[340px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-bold text-slate-500 lg:h-[500px]">
          <Search size={28} />
          템플릿을 선택하면 엑셀 미리보기가 표시됩니다.
        </div>
      )}

      {!loading && preview && (
        <div style={zoomStyle}>
          <div
            className="overflow-hidden rounded-2xl border border-slate-300 bg-white"
            style={{ minWidth: `${gridWidth || 1000}px` }}
          >
            <table className="border-collapse">
              <colgroup>
                {previewColumns.map((column, index) => (
                  <col key={column.key || column.letter || index} style={{ width: `${getColumnWidth(column)}px` }} />
                ))}
              </colgroup>

              <tbody>
                {previewRows.map((row, rowIndex) => {
                  const cells = row.cells || [];
                  const rowHeight = getRowHeight(row);

                  return (
                    <tr key={row.rowNumber || row.row || rowIndex} style={{ height: `${rowHeight}px` }}>
                      {cells.map((cell, cellIndex) => {
                        if (cell.skip || cell.isMergedHidden) return null;

                        const address = getCellAddress(cell);
                        const mapped = isCellMapped(cell);
                        const repeatStart = isRepeatStartCell(cell, mapped);
                        const value = getCellText(cell);
                        const rowSpan = Number(cell.rowspan || cell.rowSpan || 1);
                        const colSpan = Number(cell.colspan || cell.colSpan || 1);

                        return (
                          <td
                            key={address || cellIndex}
                            rowSpan={rowSpan}
                            colSpan={colSpan}
                            onClick={() => onCellClick(cell)}
                            className={[
                              "relative select-none overflow-hidden px-2 py-1 text-center align-middle transition",
                              isReadOnly ? "cursor-default" : "cursor-pointer hover:bg-blue-50",
                              mapped ? "bg-blue-50 outline outline-2 outline-blue-500" : "",
                            ].join(" ")}
                            style={buildCellStyle(cell, zoom)}
                          >
                            <div className="truncate">{value}</div>
                            {mapped && (
                              <span className="absolute right-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                                {mapped.mappingType === "REPEAT_COLUMN"
                                  ? repeatStart
                                    ? mapped.fieldLabel
                                    : ""
                                  : mapped.fieldLabel}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </section>
);

export default MappingPreviewPanel;
