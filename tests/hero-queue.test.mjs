import test from 'node:test';
import assert from 'node:assert/strict';
import { createGPU } from '../src/lib/hero/gpu.js';

// Resource/queue API tests only. Real shader checks live in hero-browser.mjs.
function harness() {
  const previous = ['navigator','GPUBufferUsage','GPUTextureUsage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]);
  const finish = [], uploads = [];
  let submissions=0;
  const resource = () => ({destroy(){},createView(){return {};}});
  const pipeline = {getBindGroupLayout(){return {};}};
  const pass = {setPipeline(){},setBindGroup(){},dispatchWorkgroups(){},draw(){},end(){}};
  const device = {
    limits:{maxTextureDimension2D:8192}, lost:new Promise(()=>{}), destroy(){},addEventListener(){},
    createBuffer:resource,createTexture:resource,createBindGroup:x=>x,
    createShaderModule:()=>({getCompilationInfo:async()=>({messages:[]})}),
    createComputePipelineAsync:async()=>pipeline,createRenderPipelineAsync:async()=>pipeline,
    createCommandEncoder:()=>({beginComputePass:()=>pass,beginRenderPass:()=>pass,finish:()=>({})}),
    queue:{writeBuffer(_b,_o,data,_s,count){if(count===8)uploads.push(data[0]);},
      submit(){submissions++;},onSubmittedWorkDone:()=>new Promise(r=>finish.push(r))},
  };
  const context={configure(){},unconfigure(){},getCurrentTexture:()=>({createView(){return {};}})};
  const canvas={getContext:()=>context};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'bgra8unorm'}}});
  Object.defineProperty(globalThis,'GPUBufferUsage',{configurable:true,value:{STORAGE:1,COPY_DST:2,UNIFORM:4}});
  Object.defineProperty(globalThis,'GPUTextureUsage',{configurable:true,value:{STORAGE_BINDING:1,TEXTURE_BINDING:2}});
  return {canvas,finish,uploads,get submissions(){return submissions;},restore(){for(const[k,v]of previous){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}};
}
const scene=x=>({shapes:[{x0:x,y0:30,x1:x,y1:60,radius:2,color:[0,1,0]}]});
const turn=()=>new Promise(r=>setImmediate(r));

test('GPU coalesces pending input to the newest scene instead of accumulating frames',async()=>{
  const h=harness(), abort=new AbortController();
  try{
    const r=await createGPU(h.canvas,()=>{},abort.signal);r.resize(192,192,1);
    r.render(scene(15));r.render(scene(30));r.render(scene(60));
    assert.equal(h.submissions,1);h.finish.shift()();await turn();
    assert.equal(h.submissions,2);assert.equal(h.uploads.length,2);assert.equal(h.uploads[1],40);
    h.finish.shift()();await r.flush();r.destroy();
  }finally{abort.abort();h.restore();}
});
test('destroy discards pending GPU frames',async()=>{
  const h=harness(), abort=new AbortController();
  try{
    const r=await createGPU(h.canvas,()=>{},abort.signal);r.resize(192,192,1);
    r.render(scene(15));r.render(scene(60));r.destroy();h.finish.shift()();await turn();
    assert.equal(h.submissions,1);assert.equal(r.alive,false);
  }finally{abort.abort();h.restore();}
});
test('resize drops geometry queued in the previous coordinate system',async()=>{
  const h=harness(), abort=new AbortController();
  try{
    const r=await createGPU(h.canvas,()=>{},abort.signal);r.resize(192,192,1);
    r.render(scene(15));r.render(scene(60));r.resize(320,560,1);
    h.finish.shift()();await turn();assert.equal(h.submissions,1);r.destroy();
  }finally{abort.abort();h.restore();}
});
