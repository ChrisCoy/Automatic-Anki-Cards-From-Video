const getArgs = (): Record<string, any> => {
  const args = process.argv.slice(2);
  const params = args.reduce((acc, curr) => {
    const [key, value] = curr.split("=");
    if(value === "true" || value === "false") {
      acc[key] = value === "true";
    } else if (Number(value) && !isNaN(Number(value))) {
      acc[key] = Number(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
  return params;
};


const args = getArgs();

export {
  args
}