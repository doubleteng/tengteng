/** Egress + Site Lab cloud storage. Deploy: execute as USER_ACCESSING, access ANYONE. */
const APP_ORIGIN = 'https://teng-teng.org';
const MAX_PROJECT_BYTES = 4000000;
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Bridge');
  template.nonce = /^[a-zA-Z0-9-]{16,80}$/.test(e.parameter.nonce || '') ? e.parameter.nonce : '';
  template.origin = APP_ORIGIN;
  return template.evaluate().setTitle('Egress + Site Lab — Google Drive').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function storage_() {
  const props = PropertiesService.getUserProperties();
  let folder;
  try { if (props.getProperty('FOLDER_ID')) folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID')); } catch (e) {}
  if (!folder) { folder = DriveApp.createFolder('Egress + Site Lab'); props.setProperty('FOLDER_ID', folder.getId()); }
  let sheet;
  try { if (props.getProperty('INDEX_ID')) sheet = SpreadsheetApp.openById(props.getProperty('INDEX_ID')).getSheets()[0]; } catch(e) {}
  if (!sheet) { const book = SpreadsheetApp.create('Egress + Site Lab — project index'); sheet = book.getSheets()[0]; sheet.appendRow(['Project ID','Name','Updated','File ID','Floors','Room occupants','Flagged checks','Review items']); DriveApp.getFileById(book.getId()).moveTo(folder); props.setProperty('INDEX_ID',book.getId()); }
  return { folder: folder, sheet: sheet };
}
function id_(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{6,80}$/.test(value)) throw Error('Invalid project ID.'); return value; }
function text_(value) { const text = String(value || '').slice(0,150); return /^[=+@-]/.test(text) ? "'"+text : text; }
function cloudCall(request) {
  if (!request || !['list','save','load'].includes(request.action)) throw Error('Unsupported cloud action.');
  const lock = LockService.getUserLock(); lock.waitLock(10000);
  try {
    const s = storage_(), rows=s.sheet.getDataRange().getValues();
    if(request.action==='list') return {projects: rows.slice(1).map(r=>({id:String(r[0]),name:String(r[1]),updated:String(r[2])})),folderUrl:s.folder.getUrl(),sheetUrl:s.sheet.getParent().getUrl()};
    const id=id_(request.id), row=rows.findIndex((r,i)=>i>0&&r[0]===id);
    if(request.action==='load') { if(row<0) throw Error('Project not found in your Drive index.'); const f=DriveApp.getFileById(rows[row][3]); const parents=f.getParents(); let own=false;while(parents.hasNext()) if(parents.next().getId()===s.folder.getId())own=true;if(!own)throw Error('File is outside your project folder.');return{project:JSON.parse(f.getBlob().getDataAsString())}; }
    const project=request.project;if(!project||project.schema!==1||project.id!==id||!Array.isArray(project.floors)||!project.site)throw Error('Invalid project.');
    const body=JSON.stringify(project);if(body.length>MAX_PROJECT_BYTES)throw Error('Cloud projects are limited to 4 MB. Remove image references or save a local project file.');
    let file;if(row>=0){file=DriveApp.getFileById(rows[row][3]);const parents=file.getParents();let own=false;while(parents.hasNext())if(parents.next().getId()===s.folder.getId())own=true;if(!own)throw Error('File is outside your project folder.');file.setContent(body);}else file=s.folder.createFile(id+'.egress.json',body,MimeType.PLAIN_TEXT);
    const totals=request.summary||{},values=[id,text_(project.name),new Date().toISOString(),file.getId(),project.floors.length,Number(totals.occupants)||0,Number(totals.flags)||0,Number(totals.reviews)||0];
    if(row>=0)s.sheet.getRange(row+1,1,1,values.length).setValues([values]);else s.sheet.appendRow(values);
    return{saved:true,id:id,fileUrl:file.getUrl(),sheetUrl:s.sheet.getParent().getUrl(),updated:values[2]};
  } finally {lock.releaseLock();}
}
