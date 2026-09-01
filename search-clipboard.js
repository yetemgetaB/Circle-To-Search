"use strict";var $=Object.defineProperty;var F=Object.getOwnPropertyDescriptor;var x=Object.getOwnPropertyNames;var C=Object.prototype.hasOwnProperty;var I=(e,t)=>{for(var r in t)$(e,r,{get:t[r],enumerable:!0})},O=(e,t,r,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of x(t))!C.call(e,i)&&i!==r&&$(e,i,{get:()=>t[i],enumerable:!(s=F(t,i))||s.enumerable});return e};var N=e=>O($({},"__esModule",{value:!0}),e);var T={};I(T,{default:()=>P});module.exports=N(T);var a=require("@raycast/api");var y=require("util"),f=require("child_process"),c=require("os"),l=require("path"),m=require("fs"),h=(0,y.promisify)(f.exec);function B(e="circle_search",t=".png"){let r=Date.now(),s=Math.floor(Math.random()*1e4);return(0,l.join)((0,c.tmpdir)(),`${e}_${r}_${s}${t}`)}function g(e){try{(0,m.existsSync)(e)&&(0,m.unlinkSync)(e)}catch{}}async function S(){let e=B("clipboard"),t=(0,c.platform)()==="win32";try{if(t){let r=`
        Add-Type -AssemblyName System.Windows.Forms;
        $img = [System.Windows.Forms.Clipboard]::GetImage();
        if ($img) {
          $img.Save('${e.replace(/\\/g,"\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png);
          $img.Dispose();
          exit 0;
        } else {
          exit 1;
        }
      `;await h(`powershell.exe -NoProfile -Command "${r.replace(/\r?\n/g," ")}"`)}else{let r=`
        set pngPath to POSIX file "${e}"
        try
          set imgData to the clipboard as \xABclass PNGf\xBB
          set fileRef to open for access pngPath with write permission
          write imgData to fileRef
          close access fileRef
        on error
          try
            close access fileRef
          end try
          error "No image in clipboard"
        end try
      `;await h(`osascript -e '${r.replace(/\r?\n/g," ")}'`)}return(0,m.existsSync)(e)&&(0,m.statSync)(e).size>0?e:null}catch{return g(e),null}}var u=require("fs"),d=require("path");async function G(e){let t=(0,u.readFileSync)(e),r=(0,d.basename)(e),s=new Blob([t],{type:"image/png"}),i=new FormData;i.append("reqtype","fileupload"),i.append("fileToUpload",s,r);let o=await fetch("https://catbox.moe/user/api.php",{method:"POST",body:i,signal:AbortSignal.timeout(12e3)});if(!o.ok)throw new Error(`Catbox returned HTTP ${o.status}`);let n=(await o.text()).trim();if(!n.startsWith("http"))throw new Error(`Catbox response invalid: ${n}`);return n}async function E(e){let t=(0,u.readFileSync)(e),r=(0,d.basename)(e),s=new Blob([t],{type:"image/png"}),i=new FormData;i.append("file",s,r);let o=await fetch("https://tmpfiles.org/api/v1/upload",{method:"POST",body:i,signal:AbortSignal.timeout(12e3)});if(!o.ok)throw new Error(`TmpFiles returned HTTP ${o.status}`);let n=await o.json();if(n.status==="success"&&n.data?.url)return n.data.url.replace("tmpfiles.org/","tmpfiles.org/dl/");throw new Error(`Unexpected TmpFiles response format: ${JSON.stringify(n)}`)}async function D(e){try{return await G(e)}catch(t){return console.warn("Primary upload failed, falling back to backup host:",t),await E(e)}}var p=require("@raycast/api"),w={google:{name:"Google Lens",getUrl:e=>`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(e)}`},bing:{name:"Bing Visual Search",getUrl:e=>`https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHRP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(e)}`},yandex:{name:"Yandex Images",getUrl:e=>`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(e)}`},tineye:{name:"TinEye",getUrl:e=>`https://tineye.com/search?url=${encodeURIComponent(e)}`},baidu:{name:"Baidu Visual Search",getUrl:e=>`https://graph.baidu.com/details?isPageLoad=1&carousel=0&entrance=GENERAL&image=${encodeURIComponent(e)}`}};function A(){return(0,p.getPreferenceValues)().searchEngine||"google"}async function b(e,t){let r=t||A();if(r==="all"){let i=Object.values(w).map(o=>(0,p.open)(o.getUrl(e)));return await Promise.all(i),"All Engines"}let s=w[r]||w.google;return await(0,p.open)(s.getUrl(e)),s.name}async function P(){await(0,a.closeMainWindow)();let e=null;try{if(e=await S(),!e){await(0,a.showToast)({style:a.Toast.Style.Failure,title:"No Image Found",message:"Please copy an image or screenshot to your clipboard first."});return}await(0,a.showHUD)("\u{1F50D} Searching clipboard image...");let t=await D(e),r=await b(t);await(0,a.showHUD)(`\u2728 Opened in ${r}`)}catch(t){let r=t instanceof Error?t.message:"Failed to search clipboard image";await(0,a.showToast)({style:a.Toast.Style.Failure,title:"Search Failed",message:r})}finally{e&&g(e)}}
