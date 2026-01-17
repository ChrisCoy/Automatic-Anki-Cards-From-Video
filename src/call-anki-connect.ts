const callAnkiConnect = async (action = "", params = {}) => {
  const res = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  if (!res.ok) throw new Error(`Failed to call AnkiConnect: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
};

export {
  callAnkiConnect
};
