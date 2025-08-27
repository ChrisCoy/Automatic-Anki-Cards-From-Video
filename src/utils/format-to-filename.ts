const formatToFilename = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "+")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
};

export {
  formatToFilename
};
