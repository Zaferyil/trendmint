const {chromium}=require('playwright');
const FPS=30,T=+(process.env.T||102),N=FPS*T,W=4,PAGE=process.env.PAGE||'index.html',OUT=process.env.OUT||'frames';
(async()=>{
  const b=await chromium.launch();
  await Promise.all([...Array(W).keys()].map(async k=>{
    const pg=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    pg.on('pageerror',e=>console.log('ERR',e.message));
    await pg.goto('file://'+__dirname+'/'+PAGE);
    await pg.evaluate(()=>document.fonts.ready);
    for(let i=k;i<N;i+=W){await pg.evaluate(t=>renderAt(t),i/FPS);
      await pg.screenshot({path:`${__dirname}/${OUT}/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:95});}
  }));
  await b.close();console.log('done',N);
})();
