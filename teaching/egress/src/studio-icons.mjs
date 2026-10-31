// Drawing-tool symbols share one stroke weight and view box.
const paths={
 select:'M5 3l13 10-7 1-3 7Z',wall:'M5 20L19 4M2 17L16 1',door:'M4 20V4h16M4 20a16 16 0 0 0 16-16',
 exit:'M10 4H4v16h6M9 12h12m-5-5 5 5-5 5',boundary:'M3 4h17v15H3ZM3 8h17',stair:'M3 20h4v-4h4v-4h4V8h5V4',
 obstacle:'M4 4h16v16H4ZM4 10l6-6M4 16L16 4M8 20L20 8m-6 12 6-6',void:'M4 4h16v16H4ZM4 4l16 16M4 20L20 4',
 common:'M3 19V9h9m0 0 8-6m-8 6 8 7',dead:'M4 20V8h14m0-4v8',probe:'M12 2v4m0 12v4M2 12h4m12 0h4M8 8h8v8H8Z',
 measure:'M3 16L16 3l5 5L8 21ZM8 11l3 3m0-6 3 3m0-6 3 3',walkable:'M3 5h10v6h8v9H3Z',siteobstacle:'M4 4h16v16H4ZM7 8l9 9M12 7l5 5',
 public:'M3 18h18M6 14V4h12v10M12 2v13m-4-4 4 4 4-4',assembly:'M4 4l5 5m6 6 5 5M4 20l5-5m6-6 5-5M8 8h8v8H8Z',
 pedestrian:'M3 20V8h12v9h6m-4-4 4 4-4 4',accessible:'M12 3v9h7l3 7M12 7h6M7 10a6 6 0 1 0 8 7',vehicle:'M4 6h16v11H4ZM7 6V3h10v3M7 17v4m10-4v4M7 10h10',
 inspector:'M3 4h18v16H3ZM15 4v16m3-11v1m0 4v1'
};
export function studioIcon(name){return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${paths[name]||paths.select}"/></svg>`;}
