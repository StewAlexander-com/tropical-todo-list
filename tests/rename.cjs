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

const html=readFileSync('index.html','utf8');
const app=readFileSync('app.js','utf8');
check(!/@media \(hover: none\)[\s\S]{0,80}\.cat-rename \{ opacity: 1/.test(html),'touch does not force folder pencils');
check(!/@media \(hover: none\)[\s\S]{0,80}\.row-actions \{ opacity: 1/.test(html),'touch does not force row edit icons');
check(/@media \(hover: hover\) and \(pointer: fine\)/.test(html),'hover reveal requires a fine pointer');
check(!/\.cat-cell:focus-within \.cat-rename/.test(html),'folder tap focus does not pin a pencil');
check(/pointerType !== 'touch'/.test(app) && /startRename\(id\)/.test(app),'press-and-hold on touch starts rename');
check(/contextmenu/.test(app),'long-press does not open the iOS callout');
check(/Yellowtail/.test(html) && /Troplist<span class="tld"[^>]*>\.com<\/span>/.test(html),'wordmark is Troplist.com in Yellowtail');
check(/Permanent\+Marker/.test(html) && /Permanent Marker/.test(html),'tagline uses Permanent Marker');
check(/A Happy Little App by/.test(html) && /href="https:\/\/stewalexander\.com\/"/.test(html),'colophon credits Stew Alexander');
check(/Pacifico/.test(html) && /\.credit \{[\s\S]*?font-family: var\(--hand\)/.test(html),'colophon uses Pacifico');
check(/\.credit \{[\s\S]*?text-align: left/.test(html) && /\.credit \{[\s\S]*?color: var\(--lava-ink\)/.test(html),'colophon is left-aligned in masthead lava');
check(/\.credit a \{[\s\S]*?font-family: var\(--mark\)/.test(html) && /#1f6bff 30%/.test(html) && /font-size: 1\.2em/.test(html),'name link is Yellowtail, 30% bluer, 20% larger');
check(!/body\.scene-on\.scrolled header \{ background: color-mix\(in srgb, var\(--bg\)/.test(html),'scrolled beach header is not a paper veil');
check(/repeat\(6, minmax\(0, 1fr\)\)/.test(html),'phones use a 6-track folder grid');
check(/<\/header>\s*<nav class="cat-strip"/.test(html),'folder strip sits below the sticky header, not inside it');
check(/body\.compose header \{ position: static/.test(html) && /classList\.toggle\('compose'/.test(app),'compose unsticks the header so add cannot slide under folders');
check(/scroll-margin-top/.test(html),'add row keeps scroll margin above the keyboard');
check(/cat-cell:nth-child\(4\) \{ grid-column: 2 \/ 4/.test(html),'second folder row is centered');
check(/many-tasks/.test(app) && /tasks\.length > 4/.test(app),'folder icons compact only when more than four tasks');
check(/body\.scrolled\.many-tasks \.cat-btn svg/.test(html),'scrolled folder icons collapse with the masthead');

console.log(`${n} rename pipeline checks passed`);
