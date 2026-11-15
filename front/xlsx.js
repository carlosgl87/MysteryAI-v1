"use strict";
/* Browser-only XLSX: minimal OOXML worksheets in a standards-compliant stored ZIP. */
const xEncode=new TextEncoder();
const xXML=x=>String(x??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]));
const xDecl='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xSS="http://schemas.openxmlformats.org/spreadsheetml/2006/main", xOO="http://schemas.openxmlformats.org/officeDocument/2006/relationships", xPK="http://schemas.openxmlformats.org/package/2006/relationships";
function xCol(i){let name="";for(i++;i>0;i=Math.floor((i-1)/26))name=String.fromCharCode(65+(i-1)%26)+name;return name;}
function xSheet(rows){
 const max=Math.max(1,...rows.map(r=>r.length)), cols=Array.from({length:max},(_,i)=>{const width=Math.min(62,Math.max(13,...rows.map(r=>String(r[i]??"").length+2)));return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>';}).join("");
 const body=rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>{
  if(v==null)return ""; const ref=xCol(j)+(i+1);
  if(typeof v==="number"&&Number.isFinite(v))return '<c r="'+ref+'"><v>'+Math.round(v*100)/100+'</v></c>';
  return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xXML(v)+'</t></is></c>';
 }).join("")+'</row>').join("");
 return xDecl+'<worksheet xmlns="'+xSS+'"><cols>'+cols+'</cols><sheetData>'+body+'</sheetData></worksheet>';
}
const xCrcTable=Uint32Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
function xCrc(data){let c=0xffffffff;for(const n of data)c=(c>>>8)^xCrcTable[(c^n)&255];return (c^0xffffffff)>>>0;}
function xZip(files){
 const blocks=[],central=[];let offset=0,cSize=0;
 const head=(n)=>new DataView(new ArrayBuffer(n));
 const u16=(h,o,v)=>h.setUint16(o,v,true),u32=(h,o,v)=>h.setUint32(o,v,true);
 for(const [name,value] of files){
  const n=xEncode.encode(name), data=xEncode.encode(value), crc=xCrc(data), l=head(30),c=head(46);
  u32(l,0,0x04034b50);u16(l,4,20);u16(l,6,0x0800);u16(l,12,33);u32(l,14,crc);u32(l,18,data.length);u32(l,22,data.length);u16(l,26,n.length);
  u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x0800);u16(c,14,33);u32(c,16,crc);u32(c,20,data.length);u32(c,24,data.length);u16(c,28,n.length);u32(c,42,offset);
  blocks.push(l.buffer,n,data);central.push(c.buffer,n);offset+=30+n.length+data.length;cSize+=46+n.length;
 }
 const end=head(22);u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);u32(end,12,cSize);u32(end,16,offset);
 return new Blob([...blocks,...central,end.buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function makeWorkbook(sheets){
 const ids=sheets.map((_,i)=>i+1);
 const files=[
  ["[Content_Types].xml",xDecl+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+ids.map(i=>'<Override PartName="/xl/worksheets/sheet'+i+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("")+'</Types>'],
  ["_rels/.rels",xDecl+'<Relationships xmlns="'+xPK+'"><Relationship Id="rId1" Type="'+xOO+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ["xl/workbook.xml",xDecl+'<workbook xmlns="'+xSS+'" xmlns:r="'+xOO+'"><sheets>'+sheets.map(([s],i)=>'<sheet name="'+xXML(s)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets></workbook>'],
  ["xl/_rels/workbook.xml.rels",xDecl+'<Relationships xmlns="'+xPK+'">'+ids.map(i=>'<Relationship Id="rId'+i+'" Type="'+xOO+'/worksheet" Target="worksheets/sheet'+i+'.xml"/>').join("")+'</Relationships>'],
  ...sheets.map((s,i)=>["xl/worksheets/sheet"+(i+1)+".xml",xSheet(s[1])])
 ];
 return xZip(files);
}
