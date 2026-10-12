const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('app.js','utf8');
const context=vm.createContext({navigator:{language:'en-US'}, Date});
vm.runInContext(source.slice(source.indexOf('const Parse ='),source.indexOf('const $ ='))+'\nglobalThis.api={Parse,Dates,Classify,Vocabulary,fuzzy};',context);
const {Classify}=context.api;
const reset=()=>Classify.applyLabels(Classify.DEFAULTS);
let n=0;
const check=(cond,msg)=>{assert.ok(cond,msg);n++;};

reset();
check(Classify.IDS.join()==='errands,groceries,home,work,misc','A–Z then Misc');
check(Classify.labelOf('work')==='Work','default Work');
check(Classify.suggest('Pay invoice',[],null,false,{},'').top==='work','invoice is work');
check(Classify.suggest('Buy milk',[],null,false,{},'').top==='groceries','milk is groceries');
check(Classify.suggest('Food shopping',[],null,false,{},'').top==='groceries','food shopping is groceries');
check(Classify.suggest('Wash the clothes',[],null,false,{},'').top==='home','laundry stays home');
check(Classify.suggest('Visit the chemist',[],null,false,{},'').top==='errands','chemist is errands');
check(Classify.suggest('Book a holiday',[],null,false,{},'').top==='misc','holiday stays misc');
check(Classify.boxFromTags(['groceries'])==='groceries','#groceries files by id');
check(Classify.boxFromTags(['errands'])==='errands','#errands files by id');

const office=Classify.setLabel('work','Office');
check(office.ok && office.label==='Office','rename Work → Office');
check(Classify.labelOf('work')==='Office','labelOf follows rename');
check(Classify.suggest('Pay invoice',[],null,false,{},'').top==='work','invoice still suggests work after rename');
check(Classify.suggest('Touch base with teammates',[],null,false,{},'').top==='work','teammates still work after rename');
check(Classify.boxFromTags(['office'])==='work','#office files to work');
check(Classify.boxFromTags(['work'])==='work','#work still files after rename');
check(Classify.boxFromTags(['Work'])==='work','default slug still files');
Classify.setLabel('work','Nexus');
check(Classify.suggest('Nexus',[],null,false,{},'').top==='work','new name alone suggests that folder');
Classify.setLabel('work','Office');

const clash=Classify.setLabel('home','office');
check(!clash.ok && clash.reason==='duplicate','duplicate names rejected');
check(Classify.labelOf('home')==='Home','failed rename leaves Home');

const empty=Classify.setLabel('work','   ');
check(empty.ok && empty.label==='Work','blank name reverts to default');
check(Classify.labelOf('work')==='Work','Work restored');
check(Classify.boxFromTags(['office'])==null,'old custom slug does not linger');

Classify.setLabel('groceries','Costco');
check(Classify.suggest('Buy milk',[],null,false,{},'').top==='groceries','milk still groceries after Costco');
check(Classify.suggest('Costco run',[],null,false,{},'').top==='groceries','Costco as a word suggests groceries');
check(Classify.boxFromTags(['costco'])==='groceries','#costco files groceries');
check(Classify.boxFromTags(['groceries'])==='groceries','#groceries still files');

const long=Classify.setLabel('misc','This name is way too long for a pill');
check(long.ok && long.label.length<=18,'names cap at 18 characters');

Classify.applyLabels({work:'Studio',errands:'Out',groceries:'Market'});
check(Classify.labelOf('work')==='Studio','applyLabels work');
check(Classify.labelOf('errands')==='Out','applyLabels errands');
check(Classify.labelOf('groceries')==='Market','applyLabels groceries');
check(Classify.suggest('Pay invoice',[],null,false,{},'').top==='work','lex still keyed by id after applyLabels');
check(Classify.boxFromTags(['studio','later'])==='work','first matching tag wins');

const unknown=Classify.setLabel('projects','Side');
check(!unknown.ok && unknown.reason==='unknown','cannot invent a sixth folder');

check(Classify.setLabel('work','Home').reason==='duplicate','Work cannot steal Home');
check(Classify.labelOf('work')==='Studio','clash leaves Studio');

reset();
check(Classify.labelOf('work')==='Work' && Classify.labelOf('groceries')==='Groceries','reset restores defaults');

console.log(`${n} rename pipeline checks passed`);
