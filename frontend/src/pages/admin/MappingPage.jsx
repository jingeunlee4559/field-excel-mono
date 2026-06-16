import { useCallback, useEffect, useMemo, useState } from "react";
import { mappingApi, templateApi, referenceApi } from "../../api";
import MappingHeader from '../../components/dashboard/MappingPage/MappingHeader';
import MappingFieldSidebar from '../../components/dashboard/MappingPage/MappingFieldSidebar';
import MappingPreviewPanel from '../../components/dashboard/MappingPage/MappingPreviewPanel';
import {
  alertSuccess,
  alertError,
  alertWarning,
  alertInfo,
  confirmSave,
} from "../../utils/swal";
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  DOCUMENT_TYPE_OPTIONS,
  FIELD_GROUP_LABELS,
  FIELD_GROUP_ORDER,
  MAPPING_TYPE_OPTIONS,
  isInvalidTemplateId,
  normalizeArrayResponse,
  normalizeTemplates,
  normalizeStandardFields,
  normalizeMappingType,
  normalizeSavedMapping,
  normalizePreviewResponse,
  getCellAddress,
  getCellRow,
  getCellColumnLetter,
  getCellText,
  parseAddress,
  isHeaderLikeCell,
  guessRepeatMaxRows,
  getPreviewRows,
  getPreviewColumns,
  getRowHeight,
  getColumnWidth,
  buildCellStyle
} from '../../components/dashboard/MappingPage/mappingPage.parts.jsx';

export default function MappingPage() {
  const [templates, setTemplates] = useState([]);
  const [standardFields, setStandardFields] = useState([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState('RECEIPT');
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedSheetName, setSelectedSheetName] = useState("");

  const [preview, setPreview] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [warning, setWarning] = useState("");

  const [selectedMappings, setSelectedMappings] = useState([]);
  const [selectedFieldKey, setSelectedFieldKey] = useState("");
  const [currentMappingType, setCurrentMappingType] = useState("SINGLE_CELL");

  const [hasSavedMappings, setHasSavedMappings] = useState(false);

  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedTemplate = useMemo(() => {
    return templates.find(
      (template) => String(template.templateId) === String(selectedTemplateId)
    );
  }, [templates, selectedTemplateId]);

  const selectedField = useMemo(() => {
    return standardFields.find((field) => field.fieldKey === selectedFieldKey);
  }, [standardFields, selectedFieldKey]);

  /**
   * 읽기 전용 조건
   * 1. 템플릿 자체가 잠긴 경우
   * 2. DB에 저장된 매핑이 이미 있는 경우
   *
   * 즉, 한 번 매핑이 저장된 템플릿은 매핑관리에서 확인만 가능
   */
  const isReadOnly = Boolean(selectedTemplate?.isLocked || hasSavedMappings);

  const fieldMap = useMemo(() => {
    return standardFields.reduce((acc, field) => {
      acc[field.fieldKey] = field;
      return acc;
    }, {});
  }, [standardFields]);

  const sortedFields = useMemo(() => {
    return [...standardFields]
      .filter((field) => field.isActive)
      .filter((field) => {
        const normalizedType = normalizeMappingType(field.defaultMappingType);
        return normalizedType === currentMappingType;
      })
      .sort((a, b) => {
        const groupDiff =
          FIELD_GROUP_ORDER.indexOf(a.fieldGroup || 'ETC') -
          FIELD_GROUP_ORDER.indexOf(b.fieldGroup || 'ETC');

        if (groupDiff !== 0) return groupDiff;
        return a.sortOrder - b.sortOrder;
      });
  }, [standardFields, currentMappingType]);

  const groupedFields = useMemo(() => {
    return sortedFields.reduce((acc, field) => {
      const group = field.fieldGroup || 'ETC';
      if (!acc[group]) acc[group] = [];
      acc[group].push(field);
      return acc;
    }, {});
  }, [sortedFields]);

  const selectedMappingMap = useMemo(() => {
    return selectedMappings.reduce((acc, mapping) => {
      acc[mapping.fieldKey] = mapping;
      return acc;
    }, {});
  }, [selectedMappings]);

  const loadTemplates = useCallback(async () => {
    const response = await templateApi.getTemplates({ page: 1, size: 100 });
    const normalized = normalizeTemplates(response);

    setTemplates(normalized);

    if (!selectedTemplateId && normalized.length > 0) {
      const firstTemplateId = normalized[0].templateId;

      if (!isInvalidTemplateId(firstTemplateId)) {
        setSelectedTemplateId(String(firstTemplateId));
      }
    }
  }, [selectedTemplateId]);

  const loadStandardFields = useCallback(async () => {
    const response = await referenceApi.getStandardFields({
      isActive: true,
      documentType: selectedDocumentType,
      includeAdvanced: showAdvancedFields,
      mappingType: currentMappingType,
    });
    const normalized = normalizeStandardFields(response);

    setStandardFields(normalized);

    if (normalized.length === 0) {
      setSelectedFieldKey("");
      return;
    }

    const stillExists = normalized.some((field) => field.fieldKey === selectedFieldKey);

    if (!selectedFieldKey || !stillExists) {
      setSelectedFieldKey(normalized[0].fieldKey);
    }
  }, [selectedFieldKey, selectedDocumentType, showAdvancedFields, currentMappingType]);

  const loadSavedMappings = useCallback(async (templateId) => {
    if (isInvalidTemplateId(templateId)) return;

    const response = await mappingApi.getTemplateMappings(templateId);
    const data = response?.data ?? response;

    const mappings = data?.mappings || data?.data?.mappings || [];

    const normalized = mappings
      .map(normalizeSavedMapping)
      .filter((mapping) => mapping.fieldKey);

    setSelectedMappings(normalized);
    setHasSavedMappings(normalized.length > 0);
  }, []);

  const loadPreview = useCallback(async (templateId, sheetName = "") => {
    if (isInvalidTemplateId(templateId)) return;

    const response = await mappingApi.getTemplateMappingPreviewGrid(templateId, {
      sheetName,
    });

    const normalized = normalizePreviewResponse(response);

    setPreview(normalized.preview);
    setSheetNames(normalized.sheetNames || []);
    setWarning(normalized.warning || "");

    const nextSheetName =
      sheetName ||
      normalized.preview?.sheetName ||
      normalized.sheetNames?.[0] ||
      "";

    setSelectedSheetName(nextSheetName);
  }, []);

  const loadTemplateMappingPage = useCallback(async () => {
    if (isInvalidTemplateId(selectedTemplateId)) {
      return;
    }

    try {
      setLoading(true);
      setWarning("");

      await loadPreview(selectedTemplateId, selectedSheetName);
      await loadSavedMappings(selectedTemplateId);
    } catch (error) {
      console.error("매핑페이지 로딩 실패:", error);

      await alertError(
        "매핑페이지 로딩 실패",
        error?.response?.data?.message ||
          error?.message ||
          "매핑페이지 데이터를 불러오지 못했습니다."
      );

      setWarning(
        error?.response?.data?.message ||
          error?.message ||
          "매핑페이지 데이터를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId, selectedSheetName, loadPreview, loadSavedMappings]);

  useEffect(() => {
    loadTemplates().catch((error) => {
      console.error("템플릿 목록 조회 실패:", error);

      alertError(
        "템플릿 목록 조회 실패",
        error?.response?.data?.message ||
          error?.message ||
          "템플릿 목록을 불러오지 못했습니다."
      );
    });

    loadStandardFields().catch((error) => {
      console.error("표준 필드 조회 실패:", error);

      alertError(
        "표준 필드 조회 실패",
        error?.response?.data?.message ||
          error?.message ||
          "표준 필드 목록을 불러오지 못했습니다."
      );
    });
  }, []);

  useEffect(() => {
    if (isInvalidTemplateId(selectedTemplateId)) {
      return;
    }

    loadTemplateMappingPage();
  }, [selectedTemplateId]);

  useEffect(() => {
    loadStandardFields().catch((error) => {
      console.error('표준 필드 재조회 실패:', error);
      alertError(
        '표준 필드 조회 실패',
        error?.response?.data?.message ||
          error?.message ||
          '표준 필드 목록을 불러오지 못했습니다.'
      );
    });
  }, [selectedDocumentType, showAdvancedFields, currentMappingType]);

  const handleSheetChange = async (event) => {
    const nextSheetName = event.target.value;
    setSelectedSheetName(nextSheetName);

    if (isInvalidTemplateId(selectedTemplateId)) return;

    try {
      setLoading(true);
      await loadPreview(selectedTemplateId, nextSheetName);
      await loadSavedMappings(selectedTemplateId);
    } catch (error) {
      console.error("시트 변경 실패:", error);

      await alertError(
        "시트 변경 실패",
        error?.response?.data?.message ||
          error?.message ||
          "시트 변경 중 오류가 발생했습니다."
      );

      setWarning(
        error?.response?.data?.message ||
          error?.message ||
          "시트 변경 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (event) => {
    const value = event.target.value;

    if (isInvalidTemplateId(value)) {
      setSelectedTemplateId("");
      setPreview(null);
      setSheetNames([]);
      setSelectedSheetName("");
      setSelectedMappings([]);
      setHasSavedMappings(false);
      return;
    }

    setSelectedTemplateId(value);
    setPreview(null);
    setSheetNames([]);
    setSelectedSheetName("");
    setSelectedMappings([]);
    setHasSavedMappings(false);
    setWarning("");
  };

  const handleFieldSelect = async (fieldKey) => {
    if (isReadOnly) {
      await alertInfo(
        "읽기 전용 화면",
        "이미 저장된 매핑은 수정할 수 없습니다. 현재 화면에서는 매핑 위치만 확인할 수 있습니다."
      );
      return;
    }

    const field = fieldMap[fieldKey];

    setSelectedFieldKey(fieldKey);

    if (field?.defaultMappingType) {
      setCurrentMappingType(field.defaultMappingType);
    }
  };

  const removeMapping = async (fieldKey) => {
    if (isReadOnly) {
      await alertWarning(
        "수정 불가",
        "이미 저장된 매핑은 삭제하거나 수정할 수 없습니다."
      );
      return;
    }

    setSelectedMappings((prev) =>
      prev.filter((mapping) => mapping.fieldKey !== fieldKey)
    );
  };

  const updateMapping = (nextMapping) => {
    setSelectedMappings((prev) => {
      const withoutCurrent = prev.filter(
        (mapping) => mapping.fieldKey !== nextMapping.fieldKey
      );

      return [...withoutCurrent, nextMapping].sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
      );
    });
  };

  const handleCellClick = async (cell) => {
    if (isReadOnly) {
      await alertInfo(
        "읽기 전용 화면",
        "이미 저장된 매핑은 수정할 수 없습니다. 현재 화면에서는 매핑 위치만 확인할 수 있습니다."
      );
      return;
    }

    if (!selectedField) {
      await alertWarning("필드 선택 필요", "먼저 왼쪽에서 표준 필드를 선택하세요.");
      return;
    }

    const address = getCellAddress(cell);

    if (!address) return;

    const parsed = parseAddress(address);
    const field = selectedField;
    const mappingType = normalizeMappingType(currentMappingType);

    if (mappingType === "SINGLE_CELL") {
      updateMapping({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        fieldName: field.fieldName,
        mappingType: "SINGLE_CELL",
        sheetName: selectedSheetName || preview?.sheetName || "Sheet1",
        cellAddress: address,
        columnLetter: null,
        startRow: null,
        maxRows: null,
        isRequired: field.isRequired,
        sortOrder: field.sortOrder,
        isLocked: false,
      });

      return;
    }

    const startRow = isHeaderLikeCell(cell)
      ? getCellRow(cell) + 1
      : getCellRow(cell) || parsed.row;

    const columnLetter = getCellColumnLetter(cell) || parsed.columnLetter;

    const maxRows = guessRepeatMaxRows(preview, {
      ...cell,
      row: startRow,
      columnLetter,
    });

    updateMapping({
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      fieldName: field.fieldName,
      mappingType: "REPEAT_COLUMN",
      sheetName: selectedSheetName || preview?.sheetName || "Sheet1",
      cellAddress: null,
      columnLetter,
      startRow,
      maxRows,
      isRequired: field.isRequired,
      sortOrder: field.sortOrder,
      isLocked: false,
    });
  };

  const handleMaxRowsChange = async (fieldKey, value) => {
    if (isReadOnly) {
      await alertWarning(
        "수정 불가",
        "이미 저장된 매핑은 최대 행 수도 수정할 수 없습니다."
      );
      return;
    }

    setSelectedMappings((prev) =>
      prev.map((mapping) =>
        mapping.fieldKey === fieldKey
          ? {
              ...mapping,
              maxRows: Number(value) || null,
            }
          : mapping
      )
    );
  };

  const handleSaveMapping = async () => {
    if (isReadOnly) {
      await alertWarning(
        "수정 불가",
        "이미 저장된 매핑은 다시 저장하거나 수정할 수 없습니다."
      );
      return;
    }

    if (isInvalidTemplateId(selectedTemplateId)) {
      await alertWarning("템플릿 선택 필요", "템플릿을 먼저 선택하세요.");
      return;
    }

    if (selectedMappings.length === 0) {
      await alertWarning("매핑 필요", "저장할 매핑 정보가 없습니다.");
      return;
    }

    const confirmResult = await confirmSave(
      "매핑을 저장하시겠습니까?",
      "저장 후에는 매핑관리 화면에서 수정할 수 없고 확인만 가능합니다."
    );

    if (!confirmResult.isConfirmed) return;

    try {
      setSaving(true);

      const payload = selectedMappings.map((mapping) => {
        const mappingType = normalizeMappingType(mapping.mappingType);

        return {
          fieldKey: mapping.fieldKey,
          mappingType,
          sheetName: mapping.sheetName || selectedSheetName || "Sheet1",
          cellAddress:
            mappingType === "SINGLE_CELL"
              ? mapping.cellAddress
              : null,
          columnLetter:
            mappingType === "REPEAT_COLUMN"
              ? mapping.columnLetter
              : null,
          startRow:
            mappingType === "REPEAT_COLUMN"
              ? mapping.startRow
              : null,
          maxRows:
            mappingType === "REPEAT_COLUMN"
              ? mapping.maxRows
              : null,
          isRequired: mapping.isRequired,
          sortOrder: mapping.sortOrder,
        };
      });

      await mappingApi.createTemplateMappings(selectedTemplateId, {
        mappings: payload,
      });

      await loadSavedMappings(selectedTemplateId);

      setHasSavedMappings(true);

      await alertSuccess(
        "매핑 저장 완료",
        "템플릿 매핑이 저장되었습니다. 이제 이 매핑은 확인만 가능합니다."
      );
    } catch (error) {
      console.error("매핑 저장 실패:", error);

      await alertError(
        "매핑 저장 실패",
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "매핑 저장 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  const isCellMapped = (cell) => {
    const address = getCellAddress(cell);
    const row = getCellRow(cell);
    const columnLetter = getCellColumnLetter(cell);
    const activeSheet = selectedSheetName || preview?.sheetName || "Sheet1";

    const matched = selectedMappings.find((mapping) => {
      if (mapping.sheetName !== activeSheet) return false;

      if (mapping.mappingType === "SINGLE_CELL") {
        return mapping.cellAddress === address;
      }

      if (mapping.mappingType === "REPEAT_COLUMN") {
        const startRow = Number(mapping.startRow || 0);
        const maxRows = Number(mapping.maxRows || 0);
        const endRow = maxRows > 0 ? startRow + maxRows - 1 : startRow + 9;

        return (
          mapping.columnLetter === columnLetter &&
          row >= startRow &&
          row <= endRow
        );
      }

      return false;
    });

    return matched || null;
  };

  const isRepeatStartCell = (cell, mapping) => {
    if (!mapping || mapping.mappingType !== "REPEAT_COLUMN") return false;

    const row = getCellRow(cell);
    const columnLetter = getCellColumnLetter(cell);

    return (
      mapping.columnLetter === columnLetter &&
      Number(mapping.startRow) === Number(row)
    );
  };

  const previewRows = getPreviewRows(preview);
  const previewColumns = getPreviewColumns(preview);

  const gridWidth = useMemo(() => {
    return previewColumns.reduce(
      (sum, column) => sum + getColumnWidth(column),
      0
    );
  }, [previewColumns]);

  const zoomStyle = {
    transform: `scale(${zoom / 100})`,
    transformOrigin: "top left",
    width: `${10000 / zoom}%`,
  };

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-4 lg:gap-5">
        <MappingHeader
          templates={templates}
          selectedTemplate={selectedTemplate}
          selectedTemplateId={selectedTemplateId}
          selectedMappingsCount={selectedMappings.length}
          warning={warning}
          saving={saving}
          isReadOnly={isReadOnly}
          onTemplateChange={handleTemplateChange}
          onRefresh={loadTemplateMappingPage}
          onSave={handleSaveMapping}
          isInvalidTemplateId={isInvalidTemplateId}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[460px_minmax(0,1fr)] 2xl:grid-cols-[500px_minmax(0,1fr)] xl:items-start xl:gap-5">
          <MappingFieldSidebar
            isReadOnly={isReadOnly}
            selectedDocumentType={selectedDocumentType}
            showAdvancedFields={showAdvancedFields}
            currentMappingType={currentMappingType}
            sortedFields={sortedFields}
            groupedFields={groupedFields}
            selectedMappingMap={selectedMappingMap}
            selectedFieldKey={selectedFieldKey}
            selectedMappings={selectedMappings}
            onDocumentTypeChange={(value) => {
              setSelectedDocumentType(value);
              setSelectedFieldKey('');
            }}
            onToggleAdvancedFields={() => setShowAdvancedFields((value) => !value)}
            onMappingTypeChange={(value) => {
              setCurrentMappingType(value);
              setSelectedFieldKey("");
            }}
            onFieldSelect={handleFieldSelect}
            onRemoveMapping={removeMapping}
            onMaxRowsChange={handleMaxRowsChange}
          />

          <MappingPreviewPanel
            selectedSheetName={selectedSheetName}
            sheetNames={sheetNames}
            zoom={zoom}
            isReadOnly={isReadOnly}
            currentMappingType={currentMappingType}
            loading={loading}
            preview={preview}
            zoomStyle={zoomStyle}
            gridWidth={gridWidth}
            previewColumns={previewColumns}
            previewRows={previewRows}
            onSheetChange={handleSheetChange}
            onZoomOut={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
            onZoomReset={() => setZoom(100)}
            onZoomIn={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
            onCellClick={handleCellClick}
            isCellMapped={isCellMapped}
            isRepeatStartCell={isRepeatStartCell}
          />
        </div>
      </div>
    </div>
  );
}
