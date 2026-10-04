const cfg=window.MURAL_CONFIG;
const sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const byId=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—';
const badge=(cls,txt)=>'<span class="badge '+cls+'">'+txt+'</span>';
let obras=[],pendencias=[],tarefas=[],pagina=0;
const POR_PAGINA=14;
async function autenticar(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){byId('login').classList.remove('hide');return}
 const {data}=await sb.from('mural_membros').select('nome').eq('user_id',session.user.id).maybeSingle();
 if(!data){await sb.auth.signOut();byId('msg').textContent='Usuário sem acesso ao Mural.';return}
 byId('login').classList.add('hide');carregar();
}
byId('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();byId('msg').textContent='Entrando...';
 const {error}=await sb.auth.signInWithPassword({email:byId('email').value,password:byId('senha').value});
 if(error){byId('msg').textContent=error.message;return}
 autenticar();
});
async function carregar(){
 const [a,b,c]=await Promise.all([
  sb.from('mural_os').select('*').eq('ativo',true),
  sb.from('mural_pendencias').select('*').eq('status','aberta'),
  sb.from('mural_tarefas_rua').select('*').not('status','in','("concluida","cancelada")')
 ]);
 if(a.error||b.error||c.error)return;
 obras=a.data||[];pendencias=b.data||[];tarefas=c.data||[];
 obras.sort((x,y)=>new Date(x.montagem_inicio||'2999-01-01')-new Date(y.montagem_inicio||'2999-01-01'));
 tarefas.sort((x,y)=>new Date(x.prazo||'2999-01-01')-new Date(y.prazo||'2999-01-01'));
 const total=Math.max(1,Math.ceil(obras.length/POR_PAGINA));if(pagina>=total)pagina=0;render();
}
function local(o){return o.local_nome&&o.local_cidade?badge('azul','✓ '+esc(o.local_nome)+' / '+esc(o.local_cidade)):badge('vermelho','✕ preencher')}
function montagem(o){if(o.classificacao_n==='N1')return badge('cinza','— N/A');return o.montagem_inicio&&o.montagem_fim?badge('azul','✓ '+fmt(o.montagem_inicio)+' → '+fmt(o.montagem_fim)):badge('vermelho','✕ definir')}
function desmontagem(o){if(o.desmontagem_aplica===false)return badge('cinza','— não');if(o.desmontagem_aplica===true&&o.desmontagem_inicio&&o.desmontagem_limite)return badge('azul','✓ '+fmt(o.desmontagem_inicio)+' → '+fmt(o.desmontagem_limite));return badge('vermelho','✕ avaliar')}
function frete(o){if(o.frete_precisa===false)return badge('cinza','— não');if(o.frete_precisa===true&&o.frete_veiculo)return badge('azul','✓ '+esc(o.frete_veiculo));return badge('vermelho','✕ avaliar')}
function docs(o){if(o.documentacao_projeto_precisa===false)return badge('cinza','— N/A');if(o.documentacao_projeto_precisa!==true)return badge('vermelho','✕ avaliar');let x=[];if(o.rrt_projeto)x.push('RRT-P');if(o.rrt_execucao)x.push('RRT-E');if(o.laudos_m)x.push('M');if(o.laudo_ignifugacao)x.push('IGN');if(o.projeto_eletrico)x.push('ELÉT');return x.length?badge('azul','✓ '+x.join(' • ')):badge('vermelho','✕ marcar docs')}
function acesso(o){if(o.acesso_sst==='nomes')return badge('azul','✓ nomes');if(o.acesso_sst==='sst_completa')return badge('azul','✓ SST completa');if(o.acesso_sst==='nao_exige')return badge('cinza','— não exige');return badge('vermelho','✕ avaliar')}
function pcount(id,tipo){return pendencias.filter(p=>p.mural_os_id===id&&p.tipo===tipo).length}
function pend(id,tipo){const n=pcount(id,tipo);return n?badge('amarelo','! '+n):badge('azul','✓ 0')}
function render(){
 const total=Math.max(1,Math.ceil(obras.length/POR_PAGINA)),ini=pagina*POR_PAGINA;
 byId('pagina').textContent='TRABALHOS '+obras.length+' • PÁGINA '+(pagina+1)+'/'+total;
 byId('body').innerHTML=obras.slice(ini,ini+POR_PAGINA).map(o=>'<tr><td><strong>'+esc(o.os_numero)+'</strong></td><td class="nivel">'+esc(o.classificacao_n||'—')+'</td><td>'+local(o)+'</td><td>'+montagem(o)+'</td><td>'+desmontagem(o)+'</td><td>'+frete(o)+'</td><td>'+docs(o)+'</td><td>'+acesso(o)+'</td><td>'+pend(o.id,'projeto')+'</td><td>'+pend(o.id,'arquivo')+'</td><td>'+pend(o.id,'material')+'</td></tr>').join('');
 byId('taskCount').textContent=tarefas.length+' abertas';
 const agora=Date.now();
 byId('tasks').innerHTML=tarefas.slice(0,5).map(t=>'<div class="task '+(t.prazo&&new Date(t.prazo).getTime()<agora?'urgent':'')+'"><strong>'+esc(t.tipo.replace('_',' ').toUpperCase())+' • '+esc(t.titulo)+'</strong><div>'+esc(t.local||'—')+' • '+fmt(t.prazo)+'</div><div>'+esc(t.responsavel||'SEM RESPONSÁVEL')+(t.os_numero?' • OS '+esc(t.os_numero):'')+'</div></div>').join('');
}
setInterval(()=>{byId('relogio').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'}).format(new Date())},1000);
setInterval(()=>{const total=Math.max(1,Math.ceil(obras.length/POR_PAGINA));if(total>1){pagina=(pagina+1)%total;render()}},12000);
let timer;const atualizar=()=>{clearTimeout(timer);timer=setTimeout(carregar,400)};
sb.channel('mural-tv').on('postgres_changes',{event:'*',schema:'public',table:'mural_os'},atualizar).on('postgres_changes',{event:'*',schema:'public',table:'mural_pendencias'},atualizar).on('postgres_changes',{event:'*',schema:'public',table:'mural_tarefas_rua'},atualizar).subscribe();
autenticar();