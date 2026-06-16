export const getTodayText = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getStoredUser = () => {
  const storageKeys = ['user', 'currentUser', 'loginUser', 'authUser'];

  for (const key of storageKeys) {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) continue;

    try {
      const parsed = JSON.parse(rawValue);
      if (parsed?.user) return parsed.user;
      if (parsed?.data?.user) return parsed.data.user;
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
};

export const normalizeDocumentType = (templateName = '') => {
  const name = templateName.replace(/\s/g, '');

  if (name.includes('영수증')) return '영수증';
  if (name.includes('거래명세서')) return '거래명세서';
  if (name.includes('자재검수')) return '자재검수증';
  if (name.includes('작업일보')) return '작업일보';
  if (name.includes('식비')) return '식비 영수증';
  if (name.includes('교통비')) return '교통비 영수증';
  if (name.includes('납품')) return '납품서';
  if (name.includes('검측')) return '검측서';

  return '영수증';
};

export const formatFileSize = (size) => {
  if (!size && size !== 0) return '-';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)}MB`;
  return `${(size / 1024).toFixed(1)}KB`;
};

export const isImageFile = (file) => file?.type?.startsWith('image/');

export const getFileKey = (file) => `${file.name}_${file.size}_${file.lastModified}`;

export const buildPreviewItem = (file) => {
  if (isImageFile(file)) {
    return {
      key: getFileKey(file),
      name: file.name,
      type: 'image',
      url: URL.createObjectURL(file),
    };
  }

  return {
    key: getFileKey(file),
    name: file.name,
    type: 'pdf',
    url: '',
  };
};

export const isAcceptedUploadFile = (file) => {
  const lowerName = String(file?.name || '').toLowerCase();

  return (
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.pdf')
  );
};
