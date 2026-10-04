const cfg=window.MURAL_CONFIG;
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
const inputDate=v=>{if(!v)return '';const d=new Date(v),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
const toIso=v=>v?new Date(v).toISOString():null;
let obras=[],pend=[],tarefas=[],modo='os';
async function auth(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){$('login').classList.remove('hide');$('app').classList.add('hide');return}
 const {data}=await sb.from('mural_membros').select('nome').eq('user_id',session.user.id).maybeSingle();
 if(!data){$('msg').textContent='Seu login existe, mas não tem acesso ao Mural.';await sb.auth.signOut();return}
 $('login').classList.add('hide');$('app').classList.remove('hide');carregar();
}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('msg').textContent='Entrando...';const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('senha').value});if(error){$('msg').textContent=error.message;return}auth()};
$('logout').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('fechar').onclick=()=>$('dlg').close();
$('tabOs').onclick=()=>{modo='os';$('tabOs').classList.add('ativo');$('tabTarefas').classList.remove('ativo');render()};
$('tabTarefas').onclick=()=>{modo='tarefas';$('tabTarefas').classList.add('ativo');$('tabOs').classList.remove('ativo');render()};
async function carregar(){
 const [a,b,c]=await Promise.all([
  sb.from('mural_os').select('*').eq('ativo',true),
  sb.from('mural_pendencias').select('*').eq('status','aberta'),
  sb.from('mural_tarefas_rua').select('*').not('status','in','("concluida","cancelada")')
 ]);
 if(a.error||b.error||c.error){$('area').innerHTML='<div class="card">Erro ao carregar.</div>';return}
 obras=a.data||[];pend=b.data||[];tarefas=c.data||[];
 obras.sort((x,y)=>new Date(x.montagem_inicio||'2999-01-01')-new Date(y.montagem_inicio||'2999-01-01'));
 tarefas.sort((x,y)=>new Date(x.prazo||'2999-01-01')-new Date(y.prazo||'2999-01-01'));
 render();
}
function st(cls,txt){return '<span class="estado '+cls+'">'+txt+'</span>'}
function counts(id,t){return pend.filter(p=>p.mural_os_id===id&&p.tipo===t).length}
function blocoLocal(o){return o.local_nome&&o.local_cidade?st('azul','✓ '+esc(o.local_nome)+' / '+esc(o.local_cidade)):st('vermelho','✕ preencher')}
function blocoMont(o){if(o.classificacao_n==='N1')return st('cinza','— N/A');return o.montagem_inicio&&o.montagem_fim?st('azul','✓ '+fmt(o.montagem_inicio)+' → '+fmt(o.montagem_fim)):st('vermelho','✕ definir')}
function blocoDesm(o){if(o.desmontagem_aplica===false)return st('cinza','— não');return o.desmontagem_aplica===true&&o.desmontagem_inicio&&o.desmontagem_limite?st('azul','✓ '+fmt(o.desmontagem_inicio)+' → '+fmt(o.desmontagem_limite)):st('vermelho','✕ avaliar')}
function blocoFrete(o){if(o.frete_precisa===false)return st('cinza','— não');return o.frete_precisa===true&&o.frete_veiculo?st('azul','✓ '+esc(o.frete_veiculo)):st('vermelho','✕ avaliar')}
function blocoDoc(o){if(o.documentacao_projeto_precisa===false)return st('cinza','— N/A');if(o.documentacao_projeto_precisa!==true)return st('vermelho','✕ avaliar');let d=[];if(o.rrt_projeto)d.push('RRT-P');if(o.rrt_execucao)d.push('RRT-E');if(o.laudos_m)d.push('M');if(o.laudo_ignifugacao)d.push('IGN');if(o.projeto_eletrico)d.push('ELÉT');return d.length?st('azul','✓ '+d.join(' • ')):st('vermelho','✕ marcar docs')}
function blocoAcesso(o){if(o.acesso_sst==='nomes')return st('azul','✓ nomes');if(o.acesso_sst==='sst_completa')return st('azul','✓ SST completa');if(o.acesso_sst==='nao_exige')return st('cinza','— não exige');return st('vermelho','✕ avaliar')}
function pcell(id,t){const n=counts(id,t);return n?st('amarelo','! '+n):st('azul','✓ 0')}
function render(){
 if(modo==='tarefas')return renderTarefas();
 $('area').innerHTML='<div class="card topbar"><div><strong>'+obras.length+' trabalhos ativos</strong><div class="small muted">Clique numa linha para editar.</div></div><button id="novoOs">+ Novo trabalho</button></div><div class="card tablewrap"><table><thead><tr><th>OS</th><th>N</th><th>Local</th><th>Montagem</th><th>Desmontagem</th><th>Frete</th><th>Documentação</th><th>Acesso/SST</th><th>Projeto</th><th>Arquivo</th><th>Material</th></tr></thead><tbody id="bodyOs"></tbody></table></div>';
 $('bodyOs').innerHTML=obras.map(o=>'<tr data-id="'+o.id+'"><td><b>'+esc(o.os_numero)+'</b></td><td><b>'+esc(o.classificacao_n||'—')+'</b></td><td>'+blocoLocal(o)+'</td><td>'+blocoMont(o)+'</td><td>'+blocoDesm(o)+'</td><td>'+blocoFrete(o)+'</td><td>'+blocoDoc(o)+'</td><td>'+blocoAcesso(o)+'</td><td>'+pcell(o.id,'projeto')+'</td><td>'+pcell(o.id,'arquivo')+'</td><td>'+pcell(o.id,'material')+'</td></tr>').join('');
 $('novoOs').onclick=()=>editarOs();
 document.querySelectorAll('#bodyOs tr').forEach(r=>r.onclick=()=>editarOs(obras.find(o=>o.id==r.dataset.id)));
}
function renderTarefas(){
 $('area').innerHTML='<div class="card topbar"><div><strong>'+tarefas.length+' tarefas abertas</strong><div class="small muted">Responsável é opcional.</div></div><button id="novaTarefa">+ Nova tarefa</button></div><div class="card tablewrap"><table style="min-width:900px"><thead><tr><th>Tipo</th><th>Tarefa</th><th>Local</th><th>Prazo</th><th>Responsável</th><th>OS</th><th>Status</th></tr></thead><tbody id="bodyT"></tbody></table></div>';
 $('bodyT').innerHTML=tarefas.map(t=>'<tr data-id="'+t.id+'"><td>'+esc(t.tipo.replace('_',' '))+'</td><td><b>'+esc(t.titulo)+'</b></td><td>'+esc(t.local||'—')+'</td><td>'+fmt(t.prazo)+'</td><td>'+esc(t.responsavel||'—')+'</td><td>'+esc(t.os_numero||'—')+'</td><td>'+esc(t.status.replace('_',' '))+'</td></tr>').join('');
 $('novaTarefa').onclick=()=>editarTarefa();
 document.querySelectorAll('#bodyT tr').forEach(r=>r.onclick=()=>editarTarefa(tarefas.find(t=>t.id==r.dataset.id)));
}
