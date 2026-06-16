import React, { useEffect, useMemo, useRef, useState } from 'react';

import { templateApi, uploadApi } from '../../api';
import { alertError, alertSuccess, alertWarning } from '../../utils/swal';
import { FiUploadCloud } from 'react-icons/fi';

import DashboardPageHeader from '../../components/dashboard/common/DashboardPageHeader';
import UploadPreviewPanel from '../../components/dashboard/UploadPage/UploadPreviewPanel';
import UploadResultPanel from '../../components/dashboard/UploadPage/UploadResultPanel';
import UploadSubmitterInfoCard from '../../components/dashboard/UploadPage/UploadSubmitterInfoCard';
import UploadTemplateForm from '../../components/dashboard/UploadPage/UploadTemplateForm';
import UploadViewerModal from '../../components/dashboard/UploadPage/UploadViewerModal';
import {
  buildPreviewItem,
  formatFileSize,
  getFileKey,
  getStoredUser,
  getTodayText,
  isAcceptedUploadFile,
  isImageFile,
  normalizeDocumentType,
} from '../../components/dashboard/UploadPage/uploadPage.utils.js';

const UploadPage = () => {
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [loginUser, setLoginUser] = useState(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.templateId) === String(templateId)),
    [templates, templateId]
  );

  const selectedDepartmentName = useMemo(() => (
    loginUser?.departmentName ||
    loginUser?.department?.departmentName ||
    loginUser?.department?.name ||
    loginUser?.department ||
    '-'
  ), [loginUser]);

  const selectedDepartmentId = useMemo(() => (
    loginUser?.departmentId ||
    loginUser?.department?.id ||
    loginUser?.department?.departmentId ||
    ''
  ), [loginUser]);

  const selectedSiteName = useMemo(() => (
    loginUser?.siteName ||
    loginUser?.site?.siteName ||
    loginUser?.site?.name ||
    loginUser?.site ||
    '현장 미지정'
  ), [loginUser]);

  const selectedSiteId = useMemo(
    () => loginUser?.siteId || loginUser?.site?.id || loginUser?.site?.siteId || '',
    [loginUser]
  );

  const documentType = useMemo(
    () => normalizeDocumentType(selectedTemplate?.templateName || ''),
    [selectedTemplate]
  );

  const autoTitle = useMemo(() => {
    const today = getTodayText();
    const siteName = selectedSiteName && selectedSiteName !== '-' ? selectedSiteName : '현장';
    const typeName = documentType || '영수증';
    return `${today} ${siteName} ${typeName}`;
  }, [selectedSiteName, documentType]);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const activeFile = files[activeIndex] || null;
  const activePreview = previews[activeIndex] || null;
  const imageCount = useMemo(() => files.filter((file) => isImageFile(file)).length, [files]);
  const pdfCount = useMemo(() => files.length - imageCount, [files, imageCount]);

  const loadTemplates = async () => {
    try {
      setTemplateLoading(true);
      const activeResult = await templateApi.getTemplates({ status: 'ACTIVE', page: 1, size: 100 });
      let nextTemplates = activeResult.items || activeResult.data?.items || [];

      if (nextTemplates.length === 0) {
        const allResult = await templateApi.getTemplates({ page: 1, size: 100 });
        nextTemplates = allResult.items || allResult.data?.items || [];
      }

      setTemplates(nextTemplates);
      if (!templateId && nextTemplates.length > 0) {
        setTemplateId(String(nextTemplates[0].templateId));
      }
    } catch (error) {
      console.error('템플릿 목록 조회 실패:', error);
      setTemplates([]);
    } finally {
      setTemplateLoading(false);
    }
  };

  useEffect(() => {
    setLoginUser(getStoredUser());
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!titleTouched) setTitle(autoTitle);
  }, [autoTitle, titleTouched]);

  useEffect(() => {
    const nextPreviews = files.map((file) => buildPreviewItem(file));
    setPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => {
        if (preview.url) URL.revokeObjectURL(preview.url);
      });
    };
  }, [files]);

  useEffect(() => {
    if (files.length === 0) {
      setActiveIndex(0);
      setViewerOpen(false);
      return;
    }

    setActiveIndex((prev) => Math.min(prev, files.length - 1));
  }, [files.length]);

  const handleTitleChange = (event) => {
    setTitle(event.target.value);
    setTitleTouched(true);
  };

  const resetAutoTitle = () => {
    setTitle(autoTitle);
    setTitleTouched(false);
  };

  const handleTemplateChange = (event) => {
    setTemplateId(event.target.value);
    setResult(null);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const appendFiles = async (selectedFiles) => {
    if (selectedFiles.length === 0) return;

    const invalidFile = selectedFiles.find((file) => !isAcceptedUploadFile(file));
    if (invalidFile) {
      await alertWarning('파일 형식 확인', 'JPG, PNG, WEBP, PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    setFiles((prevFiles) => {
      const prevKeys = new Set(prevFiles.map((file) => getFileKey(file)));
      const dedupedFiles = selectedFiles.filter((file) => !prevKeys.has(getFileKey(file)));

      if (prevFiles.length === 0 && dedupedFiles.length > 0) setActiveIndex(0);
      return [...prevFiles, ...dedupedFiles];
    });

    setResult(null);
  };

  const handleFileChange = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    await appendFiles(selectedFiles);
    event.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => {
      const nextFiles = prev.filter((_, itemIndex) => itemIndex !== index);

      if (nextFiles.length === 0) {
        setActiveIndex(0);
        setViewerOpen(false);
      } else if (index <= activeIndex) {
        setActiveIndex((prevIndex) => Math.max(0, prevIndex - 1));
      }

      return nextFiles;
    });

    setResult(null);
  };

  const clearFiles = () => {
    if (files.length === 0) return;
    setFiles([]);
    setActiveIndex(0);
    setViewerOpen(false);
    setResult(null);
  };

  const movePrev = () => {
    if (files.length <= 1) return;
    setActiveIndex((prev) => (prev === 0 ? files.length - 1 : prev - 1));
  };

  const moveNext = () => {
    if (files.length <= 1) return;
    setActiveIndex((prev) => (prev === files.length - 1 ? 0 : prev + 1));
  };

  const validateFiles = async () => {
    if (!templateId) {
      await alertWarning(
        '템플릿 선택 필요',
        '등록한 자사 경비청구서 양식에 자동 입력하려면 템플릿을 반드시 선택해야 합니다.'
      );
      return false;
    }

    if (files.length === 0) {
      await alertWarning('파일 선택 필요', '업로드할 이미지 또는 PDF를 선택해주세요.');
      return false;
    }

    const invalidFile = files.find((file) => !isAcceptedUploadFile(file));
    if (invalidFile) {
      await alertWarning('파일 형식 확인', 'JPG, PNG, WEBP, PDF 파일만 업로드할 수 있습니다.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const isValid = await validateFiles();
    if (!isValid) return;

    try {
      setUploading(true);
      setResult(null);

      const response = await uploadApi.uploadReceipts({
        files,
        title: title.trim() || autoTitle,
        templateId: templateId || undefined,
        departmentId: selectedDepartmentId || undefined,
        siteId: selectedSiteId || undefined,
        documentType,
      });

      setResult(response);
      await alertSuccess('업로드 접수 완료', '업로드가 접수되었습니다. AI 처리는 백그라운드에서 진행됩니다.');
    } catch (error) {
      console.error('업로드 실패:', error);
      await alertError(
        '업로드 실패',
        error.response?.data?.message || error.message || '파일 업로드 중 오류가 발생했습니다.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="원천자료 업로드"
        eyebrowIcon={FiUploadCloud}
        title="이미지/PDF 증빙자료 업로드"
        description="영수증 이미지 또는 PDF를 여러 개 업로드하면 서버가 접수 후 OCR/LLM 추출과 자동 검증을 백그라운드에서 진행합니다."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <UploadSubmitterInfoCard
            loginUser={loginUser}
            departmentName={selectedDepartmentName}
            siteName={selectedSiteName}
          />

          <UploadTemplateForm
            fileInputRef={fileInputRef}
            title={title}
            templateId={templateId}
            templates={templates}
            templateLoading={templateLoading}
            documentType={documentType}
            selectedTemplate={selectedTemplate}
            fileCount={files.length}
            imageCount={imageCount}
            pdfCount={pdfCount}
            totalSizeText={formatFileSize(totalSize)}
            uploading={uploading}
            onTitleChange={handleTitleChange}
            onResetAutoTitle={resetAutoTitle}
            onTemplateChange={handleTemplateChange}
            onFileChange={handleFileChange}
            onOpenFilePicker={openFilePicker}
            onClearFiles={clearFiles}
          />

          <UploadResultPanel result={result} />
        </section>

        <UploadPreviewPanel
          files={files}
          previews={previews}
          activeIndex={activeIndex}
          activeFile={activeFile}
          activePreview={activePreview}
          onPrev={movePrev}
          onNext={moveNext}
          onOpenViewer={() => setViewerOpen(true)}
          onSelectFile={setActiveIndex}
          onRemoveFile={removeFile}
          onOpenFilePicker={openFilePicker}
        />
      </form>

      <UploadViewerModal
        open={viewerOpen}
        files={files}
        activeIndex={activeIndex}
        activeFile={activeFile}
        activePreview={activePreview}
        onClose={() => setViewerOpen(false)}
        onPrev={movePrev}
        onNext={moveNext}
      />
    </div>
  );
};

export default UploadPage;
