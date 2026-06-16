const notFoundHandler = (req, res) => {
  return res.status(404).json({
    message: '요청한 API를 찾을 수 없습니다.',
    path: req.originalUrl,
  });
};

const errorHandler = (err, req, res, next) => {
  console.error(err);

  return res.status(err.statusCode || 500).json({
    message: err.message || '서버 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
