import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Eye,
  Lock,
  Minus,
  MousePointer2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Unlock,
} from "lucide-react";

import { mappingApi, templateApi, referenceApi } from "../../../api";
import MappingHeader from './MappingHeader';
import {
  alertSuccess,
  alertError,
  alertWarning,
  alertInfo,
  confirmSave,
} from "../../../utils/swal";

export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const ZOOM_STEP = 10;

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'RECEIPT', label: '영수증' },
  { value: 'TRANSACTION_STATEMENT', label: '거래명세서' },
  { value: 'DELIVERY_NOTE', label: '납품서' },
  { value: 'MATERIAL_INSPECTION', label: '자재검수증' },
  { value: 'DAILY_REPORT', label: '작업일보' },
];

export const FIELD_GROUP_LABELS = {
  BASIC: '기본정보',
  DATE: '날짜',
  VENDOR: '거래처/사용처',
  ACCOUNT: '경비/회계분류',
  ITEM: '상세내역',
  AMOUNT: '금액',
  PAYMENT: '결제/승인',
  WORK: '작업',
  DELIVERY: '납품',
  INSPECTION: '검수',
  ETC: '기타',
};

export const FIELD_GROUP_ORDER = [
  'BASIC',
  'DATE',
  'VENDOR',
  'ACCOUNT',
  'ITEM',
  'AMOUNT',
  'PAYMENT',
  'WORK',
  'DELIVERY',
  'INSPECTION',
  'ETC',
];


export const MAPPING_TYPE_OPTIONS = [
  { value: "SINGLE_CELL", label: "단일 셀", description: "상단/요약의 특정 셀에 값 입력" },
  { value: "REPEAT_COLUMN", label: "반복 컬럼", description: "상세내역 표의 컬럼에 반복 입력" },
];

export const isInvalidTemplateId = (templateId) => {
  return (
    templateId === undefined ||
    templateId === null ||
    templateId === "" ||
    templateId === "undefined" ||
    templateId === "null"
  );
};

export const normalizeArrayResponse = (response, keys = []) => {
  const data = response?.data ?? response;

  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

export const normalizeTemplates = (response) => {
  const raw = response?.data ?? response;

  let list = [];

  if (Array.isArray(raw)) {
    list = raw;
  } else if (Array.isArray(raw?.templates)) {
    list = raw.templates;
  } else if (Array.isArray(raw?.data?.templates)) {
    list = raw.data.templates;
  } else if (Array.isArray(raw?.items)) {
    list = raw.items;
  } else if (Array.isArray(raw?.data?.items)) {
    list = raw.data.items;
  } else if (Array.isArray(raw?.rows)) {
    list = raw.rows;
  } else if (Array.isArray(raw?.data?.rows)) {
    list = raw.data.rows;
  } else if (Array.isArray(raw?.data)) {
    list = raw.data;
  }

  return list
    .map((template) => {
      const id =
        template.id ??
        template.templateId ??
        template.template_id;

      return {
        id,
        templateId: id,
        templateName:
          template.templateName ||
          template.template_name ||
          template.name ||
          "이름 없는 템플릿",
        originalFileName:
          template.originalFileName ||
          template.original_file_name ||
          "",
        filePath:
          template.filePath ||
          template.file_path ||
          "",
        fileType:
          template.fileType ||
          template.file_type ||
          "",
        status: template.status || "DRAFT",
        isLocked: Boolean(template.isLocked ?? template.is_locked),
        isActive: Boolean(template.isActive ?? template.is_active ?? true),
      };
    })
    .filter((template) => !isInvalidTemplateId(template.templateId));
};

export const normalizeStandardFields = (response) => {
  return normalizeArrayResponse(response, [
    "fields",
    "standardFields",
    "standard_fields",
  ]).map((field) => {
    const fieldScope = field.fieldScope || field.field_scope || "DETAIL";

    return {
      id: field.id,
      fieldKey: field.fieldKey || field.field_key,
      fieldName:
        field.fieldName ||
        field.field_name ||
        field.fieldLabel ||
        field.field_label,
      fieldLabel:
        field.fieldLabel ||
        field.field_label ||
        field.fieldName ||
        field.field_name,
      fieldScope,
      dataType:
        field.dataType ||
        field.data_type ||
        field.fieldType ||
        field.field_type ||
        "text",
      defaultMappingType:
        field.defaultMappingType ||
        field.default_mapping_type ||
        (fieldScope === "HEADER" || fieldScope === "SUMMARY"
          ? "SINGLE_CELL"
          : "REPEAT_COLUMN"),
      isRequired: Boolean(field.isRequired ?? field.is_required),
      isActive: Boolean(field.isActive ?? field.is_active ?? true),
      sortOrder: Number(field.sortOrder ?? field.sort_order ?? 0),
      documentType: field.documentType || field.document_type || null,
      fieldGroup: field.fieldGroup || field.field_group || 'ETC',
      defaultVisibleYn: field.defaultVisibleYn || field.default_visible_yn || 'Y',
      advancedYn: field.advancedYn || field.advanced_yn || 'N',
    };
  });
};

export const normalizeMappingType = (mappingType) => {
  const value = String(mappingType || "").toUpperCase();

  if (value === "REPEAT_COLUMN" || value === "DETAIL" || value === "COLUMN") {
    return "REPEAT_COLUMN";
  }

  if (value === "SINGLE_CELL" || value === "SINGLE" || value === "CELL") {
    return "SINGLE_CELL";
  }

  return "SINGLE_CELL";
};

export const normalizeSavedMapping = (mapping) => {
  const mappingType = normalizeMappingType(
    mapping.mappingType ||
    mapping.mapping_type ||
    mapping.type ||
    "SINGLE_CELL"
  );

  return {
    mappingId: mapping.mappingId || mapping.mapping_id || mapping.id,
    fieldKey: mapping.fieldKey || mapping.field_key,
    fieldLabel:
      mapping.fieldLabel ||
      mapping.field_label ||
      mapping.fieldName ||
      mapping.field_name,
    fieldName:
      mapping.fieldName ||
      mapping.field_name ||
      mapping.fieldLabel ||
      mapping.field_label,
    mappingType,
    sheetName: mapping.sheetName || mapping.sheet_name || "Sheet1",
    cellAddress:
      mappingType === "SINGLE_CELL"
        ? mapping.cellAddress || mapping.cell_address || null
        : null,
    columnLetter:
      mappingType === "REPEAT_COLUMN"
        ? mapping.columnLetter || mapping.column_letter || null
        : null,
    startRow:
      mappingType === "REPEAT_COLUMN"
        ? Number(mapping.startRow || mapping.start_row || 0) || null
        : null,
    maxRows:
      mappingType === "REPEAT_COLUMN"
        ? Number(mapping.maxRows || mapping.max_rows || 0) || null
        : null,
    isRequired: Boolean(mapping.isRequired ?? mapping.is_required),
    sortOrder: Number(mapping.sortOrder ?? mapping.sort_order ?? 0),
    isLocked: Boolean(mapping.isLocked ?? mapping.is_locked),
  };
};

export const normalizePreviewResponse = (response) => {
  const data = response?.data ?? response;

  return {
    template: data?.template || data?.data?.template || null,
    sheetNames:
      data?.sheetNames ||
      data?.sheet_names ||
      data?.data?.sheetNames ||
      data?.data?.template?.sheetNames ||
      [],
    preview:
      data?.preview ||
      data?.data?.preview ||
      null,
    warning:
      data?.warning ||
      data?.data?.warning ||
      null,
    engine:
      data?.engine ||
      data?.data?.engine ||
      "openpyxl",
  };
};

export const getCellAddress = (cell) => {
  return cell?.address || cell?.cellAddress || cell?.coordinate || "";
};

export const getCellRow = (cell) => {
  return Number(cell?.row || cell?.rowIndex || cell?.row_number || 0);
};

export const getCellColumnLetter = (cell) => {
  return (
    cell?.columnLetter ||
    cell?.column_letter ||
    cell?.colLetter ||
    getCellAddress(cell).replace(/[0-9]/g, "") ||
    ""
  );
};

export const getCellText = (cell) => {
  return String(cell?.value ?? cell?.text ?? cell?.displayValue ?? "").trim();
};

export const parseAddress = (address) => {
  const match = String(address || "").toUpperCase().match(/^([A-Z]+)(\d+)$/);

  if (!match) {
    return {
      columnLetter: "",
      row: null,
    };
  }

  return {
    columnLetter: match[1],
    row: Number(match[2]),
  };
};

export const isHeaderLikeCell = (cell) => {
  const text = getCellText(cell);

  if (!text) return false;

  const normalized = text.replace(/\s/g, "");

  const keywords = [
    "번호",
    "일자",
    "날짜",
    "사용일자",
    "사용처",
    "항목",
    "내역",
    "적요",
    "금액",
    "비고",
    "결제",
    "사용자",
    "부서",
    "성명",
    "제목",
    "총액",
    "지출총액",
  ];

  return keywords.some((keyword) => normalized.includes(keyword));
};

export const guessRepeatMaxRows = (preview, clickedCell) => {
  const startRow = getCellRow(clickedCell);
  const clickedColumn = getCellColumnLetter(clickedCell);

  if (!preview?.rows || !startRow || !clickedColumn) return 10;

  const rows = preview.rows;
  const lowerBound = startRow;

  for (const row of rows) {
    const rowNumber = Number(row.rowNumber || row.row || row.index || 0);

    if (rowNumber <= lowerBound) continue;

    const cells = row.cells || [];

    const hasFooterText = cells.some((cell) => {
      const text = getCellText(cell).replace(/\s/g, "");

      return [
        "지급",
        "정산",
        "수령",
        "확인",
        "시행",
        "합계",
        "총계",
        "작성",
        "결재",
      ].some((keyword) => text.includes(keyword));
    });

    if (hasFooterText) {
      return Math.max(1, Math.min(rowNumber - startRow, 30));
    }
  }

  return 10;
};

export const getPreviewRows = (preview) => {
  if (!preview) return [];
  if (Array.isArray(preview.rows)) return preview.rows;
  if (Array.isArray(preview.grid)) return preview.grid;
  return [];
};

export const getPreviewColumns = (preview) => {
  if (!preview) return [];
  if (Array.isArray(preview.columns)) return preview.columns;
  return [];
};

export const getRowHeight = (row) => {
  return Number(row.heightPx || row.height || row.pixelHeight || 30);
};

export const getColumnWidth = (column) => {
  return Number(column.widthPx || column.width || column.pixelWidth || 80);
};

export const buildCellStyle = (cell, zoom) => {
  const style = cell.style || {};
  const scale = zoom / 100;

  return {
    backgroundColor:
      style.backgroundColor ||
      style.background ||
      cell.backgroundColor ||
      "#ffffff",
    color: style.color || "#0f172a",
    fontWeight: style.fontWeight || (style.bold ? 700 : 500),
    fontSize: `${Math.max(9, Number(style.fontSize || 12) * scale)}px`,
    textAlign: style.textAlign || style.align || "center",
    verticalAlign: style.verticalAlign || "middle",
    borderTop: style.borderTop || "1px solid #dbe3ef",
    borderRight: style.borderRight || "1px solid #dbe3ef",
    borderBottom: style.borderBottom || "1px solid #dbe3ef",
    borderLeft: style.borderLeft || "1px solid #dbe3ef",
    whiteSpace: style.whiteSpace || "nowrap",
  };
};

