// These are API/lifecycle tests with a test double, NOT WGSL compilation or GPU image tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGPU } from '../src/lib/hero/gpu.js';
import { layout, buildScene, Timeline, StrokeBuffer } from '../src/lib/hero/scene.js';

function setup() {
  const resources=[], writes=[], dispatches=[], passes=[];
  let destroyed=0, submitted=0, lost;
  const resource=(kind)=> {const r={kind, destroys:0, destroy(){this.destroys++;},createView(){return {texture:this};}};resources.push(r);return r;};
  const pipeline={getBindGroupLayout:()=>({})};
  const device={
    limits:{maxTextureDimension2D:8192}, lost:new Promise((resolve)=>{lost=resolve;}),
    destroy(){destroyed++;}, addEventListener(){},
    createShaderModule:()=>({getCompilationInfo:async()=>({messages:[]})}),
    createComputePipelineAsync:async()=>pipeline, createRenderPipelineAsync:async()=>pipeline,
    createBuffer:(descriptor)=>Object.assign(resource('buffer'),{descriptor}),
    createTexture:(descriptor)=>Object.assign(resource('texture'),{descriptor}),
    createBindGroup:(descriptor)=>descriptor,
    queue:{writeBuffer:(buffer,offset,data,dataOffset=0,size=data.length)=>writes.push({buffer,data:Array.from(data.slice(dataOffset,dataOffset+size))}),submit:()=>submitted++},
    createCommandEncoder:()=>({
      beginComputePass:()=>{const p={setPipeline(){},setBindGroup(_,group){this.group=group;},dispatchWorkgroups(...size){dispatches.push(size);},end(){passes.push(this.group);}};return p;},
      beginRenderPass:()=>({setPipeline(){},setBindGroup(){},draw(){},end(){}}),finish:()=>({}),
    }),
  };
  const context={configure(){},unconfigure(){},getCurrentTexture:()=>({createView:()=>({})})};
  const canvas={width:0,height:0,getContext:()=>context};
  const previous={navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),buffer:globalThis.GPUBufferUsage,texture:globalThis.GPUTextureUsage};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=> 'bgra8unorm'}}});
  globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,UNIFORM:4};globalThis.GPUTextureUsage={STORAGE_BINDING:1,TEXTURE_BINDING:2};
  return {device,canvas,resources,writes,dispatches,passes,lose:()=>lost({reason:'unknown'}),get submitted(){return submitted;},get destroyed(){return destroyed;},restore(){Object.defineProperty(globalThis,'navigator',previous.navigator);globalThis.GPUBufferUsage=previous.buffer;globalThis.GPUTextureUsage=previous.texture;}};
}

test('GPU records field -> five far-to-near cascades -> composite with separate uniforms',async()=>{
  const m=setup();const abort=new AbortController();
  try {
    const renderer=await createGPU(m.canvas,()=>{},abort.signal);renderer.resize(1536,640,2);
    renderer.render(buildScene(layout(1536,640),new Timeline(),new StrokeBuffer()));
    assert.equal(m.submitted,1);assert.equal(m.dispatches.length,6);
    assert.equal(m.writes.length,8);assert.equal(new Set(m.writes.slice(1).map((w)=>w.buffer)).size,7);
    assert.equal(m.writes[3].data[4],2); // cascade 0 has two-pixel probe spacing
    assert.equal(m.writes[7].data[4],32);assert.equal(m.writes[7].data[9],1); // terminal cascade
    for(const pass of m.passes.slice(1)) assert.notEqual(pass.entries[2].resource.texture,pass.entries[3].resource.texture);
    renderer.destroy();assert.equal(renderer.alive,false);
  } finally {abort.abort();m.restore();}
});
test('resize releases old textures; destroy and abort are idempotent',async()=>{
  const m=setup();const abort=new AbortController();
  try {
    const renderer=await createGPU(m.canvas,()=>{},abort.signal);renderer.resize(1536,640,1);
    const first=m.resources.filter((r)=>r.kind==='texture');renderer.resize(390,740,1);
    assert.ok(first.every((r)=>r.destroys===1));renderer.destroy();renderer.destroy();abort.abort();
    assert.ok(m.resources.every((r)=>r.destroys===1));assert.equal(m.destroyed,1);
  } finally {m.restore();}
});
test('cancelled initialization destroys the acquired device',async()=>{
  const m=setup();const abort=new AbortController();
  m.device.createShaderModule=()=>({getCompilationInfo:async()=>{abort.abort();return {messages:[]};}});
  try {await assert.rejects(createGPU(m.canvas,()=>{},abort.signal));assert.equal(m.destroyed,1);}finally{m.restore();}
});
test('device loss notifies the owner once and releases resources',async()=>{
  const m=setup();const abort=new AbortController();let failures=0;
  try {
    const renderer=await createGPU(m.canvas,()=>failures++,abort.signal);renderer.resize(1536,640,1);
    m.lose();await new Promise((resolve)=>setImmediate(resolve));
    assert.equal(failures,1);assert.equal(renderer.alive,false);assert.ok(m.resources.every((r)=>r.destroys===1));
    renderer.destroy();assert.equal(failures,1);
  }finally{abort.abort();m.restore();}
});
test('shader compilation errors trigger cleanup rather than leaving a blank live renderer',async()=>{
  const m=setup();const abort=new AbortController();
  m.device.createShaderModule=()=>({getCompilationInfo:async()=>({messages:[{type:'error',lineNum:12,message:'test error'}]})});
  try {await assert.rejects(createGPU(m.canvas,()=>{},abort.signal),/test error/);assert.equal(m.destroyed,1);}finally{abort.abort();m.restore();}
});
