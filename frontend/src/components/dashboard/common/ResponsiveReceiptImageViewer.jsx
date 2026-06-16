import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiImage, FiMaximize2, FiMinus, FiPlus, FiRotateCw, FiX } from 'react-icons/fi';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.2;
const ZOOM_STEP = 0.2;

const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

const normalizeRotation = (rotation) => {
  const normalized = Number(rotation || 0) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const isRightAngleRotation = (rotation) => normalizeRotation(rotation) % 180 !== 0;

const getImageLayout = ({ naturalSize, viewerSize, zoom, rotation, mode = 'width' }) => {
  const naturalWidth = Number(naturalSize.width) || 0;
  const naturalHeight = Number(naturalSize.height) || 0;

  if (!naturalWidth || !naturalHeight) {
    return {
      ready: false,
      imageWidth: 0,
      imageHeight: 0,
      boxWidth: 0,
      boxHeight: 0,
    };
  }

  const rotated = isRightAngleRotation(rotation);
  const fitSourceWidth = rotated ? naturalHeight : naturalWidth;
  const fitSourceHeight = rotated ? naturalWidth : naturalHeight;
  // viewer padding + image canvas padding + scrollbar 여유값을 제외해서
  // 기본 맞춤(100%) 상태에서 가로 스크롤이 생기지 않게 한다.
  const availableWidth = Math.max(180, Number(viewerSize.width || 0) - 64);
  const availableHeight = Math.max(220, Number(viewerSize.height || 0) - 64);

  const widthFitScale = availableWidth / fitSourceWidth;
  const containFitScale = Math.min(widthFitScale, availableHeight / fitSourceHeight);
  const fitScale = mode === 'contain' ? containFitScale : widthFitScale;
  const scale = Math.max(0.08, fitScale * Number(zoom || 1));

  const imageWidth = Math.max(80, Math.round(naturalWidth * scale));
  const imageHeight = Math.max(80, Math.round(naturalHeight * scale));

  return {
    ready: true,
    imageWidth,
    imageHeight,
    boxWidth: rotated ? imageHeight : imageWidth,
    boxHeight: rotated ? imageWidth : imageHeight,
  };
};

const useElementSize = (activeKey) => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) });
    };

    updateSize();

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    if (resizeObserver && ref.current) resizeObserver.observe(ref.current);
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [activeKey]);

  return [ref, size];
};

const ImageCanvas = ({ imageUrl, fileName, rotation, layout, onImageLoad, emptyMinHeight = '320px' }) => {
  if (!imageUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-center text-slate-400" style={{ minHeight: emptyMinHeight }}>
        <FiImage className="text-5xl" />
        <p className="mt-3 text-sm font-bold">표시할 원본 이미지가 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-full min-w-0 items-start justify-center p-2"
      style={{ minWidth: layout.ready ? `${Math.ceil(layout.boxWidth) + 16}px` : '100%' }}
    >
      <div
        className="relative shrink-0"
        style={
          layout.ready
            ? {
                width: `${layout.boxWidth}px`,
                height: `${layout.boxHeight}px`,
              }
            : {
                width: '100%',
                minHeight: emptyMinHeight,
              }
        }
      >
        <img
          src={imageUrl}
          alt={fileName || '원본 이미지'}
          onLoad={onImageLoad}
          draggable={false}
          className="select-none rounded-xl bg-white object-contain shadow-sm"
          style={
            layout.ready
              ? {
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${layout.imageWidth}px`,
                  height: `${layout.imageHeight}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }
              : {
                  width: '100%',
                  maxWidth: '100%',
                  height: 'auto',
                }
          }
        />
      </div>
    </div>
  );
};

const ResponsiveReceiptImageViewer = ({
  imageUrl,
  fileName,
  zoom,
  setZoom,
  rotation,
  setRotation,
  modalOpen,
  setModalOpen,
  className = '',
}) => {
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewerRef, viewerSize] = useElementSize(`${imageUrl || ''}-${modalOpen ? 'modal-open' : 'modal-closed'}`);
  const [modalViewerRef, modalViewerSize] = useElementSize(`${imageUrl || ''}-${modalOpen ? 'modal' : 'inline'}`);

  useEffect(() => {
    setNaturalSize({ width: 0, height: 0 });
  }, [imageUrl]);

  const zoomPercent = Math.round(Number(zoom || 1) * 100);

  const inlineLayout = useMemo(
    () => getImageLayout({ naturalSize, viewerSize, zoom, rotation, mode: 'width' }),
    [naturalSize, viewerSize, zoom, rotation]
  );

  const modalLayout = useMemo(
    () => getImageLayout({ naturalSize, viewerSize: modalViewerSize, zoom, rotation, mode: 'width' }),
    [naturalSize, modalViewerSize, zoom, rotation]
  );

  const handleImageLoad = (event) => {
    const image = event.currentTarget;
    const width = image.naturalWidth || 0;
    const height = image.naturalHeight || 0;
    if (!width || !height) return;
    setNaturalSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const decreaseZoom = () => setZoom((prev) => clampZoom(Number(prev || 1) - ZOOM_STEP));
  const increaseZoom = () => setZoom((prev) => clampZoom(Number(prev || 1) + ZOOM_STEP));
  const resetZoom = () => setZoom(1);
  const rotateImage = () => setRotation((prev) => normalizeRotation(Number(prev || 0) + 90));

  const inlineOverflowX = Number(zoom || 1) > 1.01 ? 'overflow-x-auto' : 'overflow-x-hidden';
  const modalOverflowX = Number(zoom || 1) > 1.01 ? 'overflow-x-auto' : 'overflow-x-hidden';

  return (
    <>
      <div className={`min-w-0 overflow-hidden rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-100 ${className}`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="button" onClick={decreaseZoom} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <FiMinus />
            </button>
            <span className="min-w-0 rounded-full bg-white px-3 py-2 text-center text-xs font-black text-slate-500 ring-1 ring-slate-200">
              화면맞춤 기준 · {zoomPercent}%
            </span>
            <button type="button" onClick={increaseZoom} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <FiPlus />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button type="button" onClick={resetZoom} className="h-10 rounded-2xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              맞춤
            </button>
            <button type="button" onClick={() => setModalOpen(true)} className="h-10 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white shadow-sm hover:bg-blue-600">
              <FiMaximize2 className="inline" /> 크게보기
            </button>
          </div>
        </div>

        <div
          ref={viewerRef}
          className={`relative flex h-[52vh] min-h-[320px] min-w-0 items-start justify-center overflow-y-auto ${inlineOverflowX} rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:h-[62vh] sm:min-h-[440px] xl:h-[calc(100%-58px)] xl:min-h-0`}
        >
          <ImageCanvas
            imageUrl={imageUrl}
            fileName={fileName}
            rotation={rotation}
            layout={inlineLayout}
            onImageLoad={handleImageLoad}
          />
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-6">
          <div className="flex h-full max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{fileName || '원본 이미지'}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">화면맞춤 기준 {zoomPercent}%</p>
              </div>

              <div className="grid grid-cols-5 gap-2 sm:flex sm:items-center">
                <button type="button" onClick={decreaseZoom} className="flex h-10 min-w-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                  <FiMinus />
                </button>
                <button type="button" onClick={resetZoom} className="flex h-10 min-w-0 items-center justify-center rounded-2xl border border-slate-200 px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                  맞춤
                </button>
                <button type="button" onClick={increaseZoom} className="flex h-10 min-w-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                  <FiPlus />
                </button>
                <button type="button" onClick={rotateImage} className="flex h-10 min-w-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                  <FiRotateCw />
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="flex h-10 min-w-0 items-center justify-center rounded-2xl bg-slate-950 text-white hover:bg-blue-600">
                  <FiX />
                </button>
              </div>
            </div>

            <div ref={modalViewerRef} className={`min-h-0 flex-1 overflow-y-auto ${modalOverflowX} bg-slate-100 p-3 sm:p-4`}>
              <ImageCanvas
                imageUrl={imageUrl}
                fileName={fileName}
                rotation={rotation}
                layout={modalLayout}
                onImageLoad={handleImageLoad}
                emptyMinHeight="520px"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResponsiveReceiptImageViewer;
