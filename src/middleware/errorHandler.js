function notFound(req, res, next) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    return res.status(409).json({ message: 'A record with this value already exists.' });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Something went wrong on our end.',
  });
}

module.exports = { notFound, errorHandler };
