const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {generateFloorPlanSvg} = require('../lib/floor-plan.ts');
const {generateRubyScript} = require('../lib/ruby-generator.ts');
const {buildBoothScene} = require('../lib/booth-geometry.ts');
const fixture = {projectName:'Fixture',clientName:'Fixture',boothName:'Fixture Booth',width:6,depth:4,wallHeight:3,style:'modern',openSides:['front'],scenes:[{name:'Front',eye:{x:-4,y:-5,z:5},target:{x:3,y:2,z:1}}],elements:[{id:'desk',type:'reception_desk',label:'Welcome',position:{x:2,y:1},dimensions:{width:2,depth:0.6,height:1}},{id:'floor',type:'floor',position:{x:0,y:0},dimensions:{width:6,depth:4,height:0.05}}]};
fs.writeFileSync('/tmp/booth-delivery-fixture.json',JSON.stringify({config:fixture,rubyScript:generateRubyScript(fixture),floorPlanSvg:generateFloorPlanSvg(fixture),warnings:[]}));
test('SVG escapes markup and does not reorder caller elements',()=>{
 const c=structuredClone(fixture);c.boothName='<script>alert(1)</script>';c.elements[0].label='<image href="x" onerror="alert(1)"/>';
 const before=JSON.stringify(c);const svg=generateFloorPlanSvg(c);assert.equal(JSON.stringify(c),before);assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('<image'));assert.ok(svg.includes('&lt;script&gt;'));
});
test('attribute colors and nonnumeric geometry are rejected in every export',()=>{
 for(const change of [c=>c.elements[0].color='red" onload="alert(1)',c=>c.elements[0].position.x='0;exit',c=>c.width=Infinity,c=>c.elements[0].count=500000]) {
 const c=structuredClone(fixture);change(c);for(const generate of [generateFloorPlanSvg,generateRubyScript,buildBoothScene])assert.throws(()=>generate(c));
 }
});
test('Ruby hostile labels remain literals; syntax validation does not execute script',()=>{
 const c=structuredClone(fixture);c.boothName='"; puts "injected"\n#{system("not-run")}';c.elements[0].id='x; exit\n';c.elements[0].label=c.boothName;c.scenes[0].name=c.boothName;
 const ruby=generateRubyScript(c);assert.ok(ruby.includes('\\#{system'));assert.ok(!ruby.includes('x; exit'));assert.match(execFileSync('ruby',['-c'],{input:ruby,encoding:'utf8'}),/Syntax OK/);
});
test('fixture creates named finite 3D mesh geometry',()=>{
 const scene=buildBoothScene(fixture);assert.equal(scene.children.length,fixture.elements.length);let meshes=0;scene.traverse(obj=>{if(obj.isMesh){meshes++;for(const n of obj.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});assert.ok(meshes>0);
});

test('Ruby scene cameras use the supported mutable Camera API',()=>{
 const ruby=generateRubyScript(fixture);
 assert.ok(!/page_\d+\.camera\s*=/.test(ruby));
 assert.match(ruby,/page_0\.camera\.set\(cam_0\.eye, cam_0\.target, cam_0\.up\)/);
 assert.match(execFileSync('ruby',['-c'],{input:ruby,encoding:'utf8'}),/Syntax OK/);
});
