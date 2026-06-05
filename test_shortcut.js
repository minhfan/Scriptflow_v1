const defaultShortcuts = { tcin: { key:'I', shift:false, ctrl:false, alt:false } };
const e = { key: 'i', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };
const sc = defaultShortcuts['tcin'];
const keyMatch = sc.key === ' ' ? e.key === ' ' : e.key.toUpperCase() === sc.key.toUpperCase();
const res = keyMatch && e.shiftKey === sc.shift && (e.ctrlKey || e.metaKey) === sc.ctrl && e.altKey === sc.alt;
console.log(res);
