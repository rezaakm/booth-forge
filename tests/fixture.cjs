const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {generateFloorPlanSvg} = require('../lib/floor-plan.ts');
const {generateRubyScript} = require('../lib/ruby-generator.ts');
const {buildBoothScene} = require('../lib/booth-geometry.ts');
const fixture = {projectName:'Fixture',clientName:'Fixture',boothName:'Fixture Booth',width:6,depth:4,wallHeight:3,style:'modern',openSides:['front'],scenes:[{name:'Front',eye:{x:-4,y:-5,z:5},target:{x:3,y:2,z:1}}],elements:[{id:'desk',type:'reception_desk',label:'Welcome',position:{x:2,y:1},dimensions:{width:2,depth:0.6,height:1}},{id:'floor',type:'floor',position:{x:0,y:0},dimensions:{width:6,depth:4,height:0.05}}]};
module.exports = {fixture,generateFloorPlanSvg,generateRubyScript,buildBoothScene};
