Parse.initialize("UzhGs8AnUe3qOl836wSLsVG1iVhlb5vkRknFkvyH", "NguMpB9MrkVYtve3NqjJrHGCu3oZBDjf5ivICEBZ");
Parse.serverURL = "https://parseapi.back4app.com/";

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se o usuário está logado no Parse.
    // Se não estiver, redireciona para a página de login (presumivelmente 'index.html').
    currentUser = Parse.User.current();
    if (!currentUser) {
        console.log("Nenhum usuário logado, redirecionando para a página de login...");
        // Redireciona para a sua página de login externa
        window.location.href = 'index.html'; 
        return; // Impede que o restante do script seja executado
    }

    // Se o usuário estiver logado, continua a inicialização do feed.
    console.log("Usuário logado:", currentUser.get('username'));

    // Verifica a função do usuário (ex: 'admin', 'agent') e atualiza a interface.
    // A seção de avisos de admin só será visível para usuários com a função 'admin'.
    const userRole = currentUser.get('role');
    if (userRole === 'admin') {
        const adminNoticesContainer = document.getElementById('admin-notices-container');
        if (adminNoticesContainer) {
            adminNoticesContainer.style.display = 'block';
            // Você pode carregar avisos de admin aqui, se houver.
            // Ex: loadAdminNotices();
            document.getElementById('admin-notice-content').textContent = "Bem-vindo, Admin! Gerencie avisos importantes aqui.";
        }
    }

    // Atualiza as informações do usuário no cabeçalho e no input de postagem.
    updateUserHeader();
    
    // Carrega e exibe as postagens existentes no feed.
    await loadPosts();
});

/**
 * Abre o modal para o usuário criar uma nova postagem.
 */
function openPostModal() {
    const postModal = document.getElementById('postModal');
    if (postModal) {
        postModal.style.display = 'flex';
        // Foca na área de texto para facilitar a digitação.
        document.getElementById('postTextarea').focus();
    }
}

/**
 * Fecha o modal de criação de postagem e limpa a área de texto.
 */
function closePostModal() {
    const postModal = document.getElementById('postModal');
    if (postModal) {
        postModal.style.display = 'none';
        document.getElementById('postTextarea').value = '';
    }
}

/**
 * Envia uma nova postagem para o servidor Parse.
 * A postagem inclui o conteúdo, o usuário que a criou e o nome/avatar do usuário para exibição.
 */
async function submitPost() {
    const content = document.getElementById('postTextarea').value.trim();
    if (!content) {
        showToast('Por favor, escreva algo para postar.', 'error');
        return;
    }
    
    // Verifica novamente se o usuário está logado, embora a página já o exija.
    if (!currentUser) {
        showToast('Você precisa estar logado para postar.', 'error');
        return;
    }

    try {
        const Post = Parse.Object.extend('Post');
        const newPost = new Post();
        newPost.set('content', content);
        newPost.set('user', currentUser);
        // Salva o nome e a URL do avatar do usuário diretamente no post para facilitar a exibição.
        newPost.set('userName', currentUser.get('name') || currentUser.get('username') || 'Usuário');
        const avatarUrl = currentUser.get('picture') || (currentUser.get('profilePicture') && currentUser.get('profilePicture').url());
        if (avatarUrl) {
            newPost.set('userPicture', avatarUrl);
        }
        
        await newPost.save(); // Salva a nova postagem no Parse.
        
        closePostModal(); // Fecha o modal após a postagem.
        await loadPosts(); // Recarrega o feed para exibir a nova postagem.
        showToast('Postagem criada com sucesso!', 'success');

    } catch (error) {
        console.error("Erro ao salvar postagem:", error);
        showToast(`Erro ao postar: ${error.message}`, 'error');
    }
}

/**
 * Carrega todas as postagens do servidor Parse, incluindo os dados do usuário,
 * e as renderiza no feed. Também carrega comentários e reações para cada post.
 */
async function loadPosts() {
    const postsContainer = document.getElementById('posts-container');
    const Post = Parse.Object.extend('Post');
    const query = new Parse.Query(Post);
    query.include('user'); // Garante que os dados do usuário associado sejam incluídos.
    query.descending('createdAt'); // Ordena as postagens da mais recente para a mais antiga.
    query.limit(20); // Limita o número de postagens carregadas.

    try {
        const results = await query.find();
        if (!postsContainer) return; // Garante que o container exista.
        postsContainer.innerHTML = ''; // Limpa o feed antes de adicionar novas postagens.
        
        if (results.length === 0) {
            postsContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Nenhuma postagem ainda. Seja o primeiro a postar!</div>';
            return;
        }

        // Para cada postagem, cria o elemento HTML e adiciona ao feed.
        for (const post of results) {
            const postElement = createPostElement(post);
            postsContainer.appendChild(postElement);
            // Carrega e exibe comentários e reações para cada post.
            await loadComments(post.id);
            await loadReactions(post.id);
        }

    } catch (error) {
        console.error("Erro ao carregar posts:", error);
        postsContainer.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 20px;">Erro ao carregar postagens.</div>';
    }
}

/**
 * Cria e retorna um elemento HTML para uma única postagem.
 * Inclui informações do usuário, conteúdo, botões de ação (curtir, comentar)
 * e placeholders para comentários e reações.
 * @param {Parse.Object} post - O objeto Parse da postagem.
 * @returns {HTMLElement} O elemento DIV que representa a postagem.
 */
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    const postData = post.toJSON();
    
    // Tenta obter o nome e a foto do usuário do post, ou do objeto user incluído, ou usa um fallback.
    const username = postData.userName || (postData.user ? postData.user.name || postData.user.username : 'Usuário Desconhecido');
    const profilePicture = postData.userPicture || (postData.user && (postData.user.picture || (postData.user.profilePicture && postData.user.profilePicture.url))) || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=40&background=random&color=fff&format=png&rounded=true`;
    
    const timeAgo = getTimeAgo(postData.createdAt);

    postDiv.innerHTML = `
        <div class="user-info">
            <img src="${profilePicture}" alt="User Avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=40&background=random&color=fff&format=png&rounded=true'"/>
            <div>
                <div class="name">${username}</div>
                <div class="time">${timeAgo}</div>
            </div>
        </div>
        <div class="content">${postData.content}</div>
        <div class="post-actions">
            <button class="action-btn" onclick="addReaction('${post.id}', '👍')">
                <span>👍</span> <span id="reactions-count-${post.id}">0</span> Curtidas
            </button>
            <button class="action-btn" onclick="toggleComments('${post.id}')">
                <span>💬</span> Comentários
            </button>
        </div>
        <div class="comments-section" id="comments-section-${post.id}" style="display: none;">
            <div id="comments-list-${post.id}"></div>
            <div class="comment-compose">
                <div class="comment-avatar">
                    <img id="comment-user-avatar-${post.id}-img" style="display: none;" />
                    <span class="avatar-letter" id="comment-user-avatar-${post.id}-letter">?</span>
                </div>
                <textarea id="comment-input-${post.id}" placeholder="Adicionar um comentário..." oninput="handleCommentInput('${post.id}')"></textarea>
                <button class="send-btn" id="comment-send-btn-${post.id}" onclick="addComment('${post.id}')" disabled>Postar</button>
            </div>
        </div>
    `;
    
    // Atualiza o avatar do usuário no formulário de comentário para este post.
    updateCommentAvatar(post.id);
    return postDiv;
}

/**
 * Atualiza o avatar do usuário no campo de comentário de um post específico.
 * @param {string} postId - O ID da postagem.
 */
function updateCommentAvatar(postId) {
    if (!currentUser) return; // Não faz nada se não houver usuário logado.

    const userName = currentUser.get('name') || currentUser.get('username') || 'Usuário';
    const avatarUrl = currentUser.get('picture') || (currentUser.get('profilePicture') && currentUser.get('profilePicture').url());
    
    const commentUserAvatarImg = document.getElementById(`comment-user-avatar-${postId}-img`);
    const commentUserAvatarLetter = document.getElementById(`comment-user-avatar-${postId}-letter`);

    if (avatarUrl) {
        if (commentUserAvatarImg) {
            commentUserAvatarImg.src = avatarUrl;
            commentUserAvatarImg.style.display = 'block';
        }
        if (commentUserAvatarLetter) commentUserAvatarLetter.style.display = 'none';
    } else {
        const initial = userName.charAt(0).toUpperCase();
        if (commentUserAvatarLetter) commentUserAvatarLetter.textContent = initial;
        if (commentUserAvatarImg) commentUserAvatarImg.style.display = 'none';
        if (commentUserAvatarLetter) commentUserAvatarLetter.style.display = 'block';
    }
}

/**
 * Adiciona um novo comentário a uma postagem específica.
 * @param {string} postId - O ID da postagem à qual o comentário será adicionado.
 */
async function addComment(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const content = commentInput.value.trim();
    if (!content) {
        showToast('O comentário não pode ser vazio.', 'error');
        return;
    }

    try {
        const Comment = Parse.Object.extend('Comment');
        const newComment = new Comment();
        newComment.set('content', content);
        newComment.set('user', currentUser); // Associa o comentário ao usuário logado.
        newComment.set('post', { __type: 'Pointer', className: 'Post', objectId: postId }); // Associa o comentário à postagem.
        
        await newComment.save(); // Salva o comentário no Parse.
        
        commentInput.value = ''; // Limpa o campo de entrada.
        handleCommentInput(postId); // Desativa o botão de envio.
        await loadComments(postId); // Recarrega os comentários para exibir o novo.
        showToast('Comentário adicionado.', 'success');

    } catch (error) {
        console.error("Erro ao adicionar comentário:", error);
        showToast(`Erro ao comentar: ${error.message}`, 'error');
    }
}

/**
 * Carrega e exibe os comentários de uma postagem específica.
 * @param {string} postId - O ID da postagem cujos comentários serão carregados.
 */
async function loadComments(postId) {
    const commentsList = document.getElementById(`comments-list-${postId}`);
    const Comment = Parse.Object.extend('Comment');
    const query = new Parse.Query(Comment);
    query.equalTo('post', { __type: 'Pointer', className: 'Post', objectId: postId });
    query.include('user'); // Inclui os dados do usuário que fez o comentário.
    query.ascending('createdAt'); // Ordena os comentários por data de criação.

    try {
        const comments = await query.find();
        if (!commentsList) return; // Garante que a lista de comentários exista.
        commentsList.innerHTML = ''; // Limpa a lista antes de adicionar os comentários.
        
        comments.forEach(comment => {
            const commentData = comment.toJSON();
            const user = commentData.user || {};
            const username = user.name || user.username || 'Usuário Desconhecido';
            const profilePicture = user.picture || (user.profilePicture && user.profilePicture.url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=32&background=random&color=fff&format=png&rounded=true`;
            const timeAgo = getTimeAgo(commentData.createdAt);

            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <div class="comment-header">
                    <img src="${profilePicture}" alt="User Avatar" class="comment-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=32&background=random&color=fff&format=png&rounded=true'"/>
                    <div class="comment-main">
                        <div class="comment-bubble">
                            <div class="comment-username">${username}</div>
                            <div class="comment-content">${commentData.content}</div>
                        </div>
                    </div>
                </div>
                <div class="comment-meta">
                    <span class="comment-time">${timeAgo}</span>
                </div>
            `;
            commentsList.appendChild(commentElement);
        });
    } catch (error) {
        console.error("Erro ao carregar comentários:", error);
    }
}

/**
 * Adiciona ou remove uma reação (curtida/emoji) a uma postagem.
 * Se o usuário já reagiu com o mesmo emoji, a reação é removida.
 * Se reagiu com um emoji diferente, a reação é atualizada.
 * Se não reagiu, uma nova reação é criada.
 * @param {string} postId - O ID da postagem.
 * @param {string} emoji - O emoji da reação (ex: '👍', '❤️').
 */
async function addReaction(postId, emoji) {
    if (!currentUser) {
        showToast('Você precisa estar logado para reagir.', 'error');
        return;
    }
    
    try {
        const Reaction = Parse.Object.extend('Reaction');
        const query = new Parse.Query(Reaction);
        query.equalTo('post', { __type: 'Pointer', className: 'Post', objectId: postId });
        query.equalTo('user', currentUser); // Busca a reação do usuário logado para este post.
        
        let existingReaction = await query.first();
        
        if (existingReaction) {
            if (existingReaction.get('reactionType') === emoji) {
                // Se o mesmo emoji, remove a reação.
                await existingReaction.destroy();
            } else {
                // Se emoji diferente, atualiza a reação.
                existingReaction.set('reactionType', emoji);
                await existingReaction.save();
            }
        } else {
            // Se não houver reação, cria uma nova.
            const newReaction = new Reaction();
            newReaction.set('post', { __type: 'Pointer', className: 'Post', objectId: postId });
            newReaction.set('user', currentUser);
            newReaction.set('reactionType', emoji);
            await newReaction.save();
        }

        await loadReactions(postId); // Recarrega as reações para atualizar a contagem.
        showToast('Reação adicionada!', 'success');

    } catch (error) {
        console.error("Erro ao adicionar reação:", error);
        showToast(`Erro ao reagir: ${error.message}`, 'error');
    }
}

/**
 * Carrega a contagem de reações para uma postagem específica e atualiza a exibição.
 * @param {string} postId - O ID da postagem.
 */
async function loadReactions(postId) {
    const Reaction = Parse.Object.extend('Reaction');
    const query = new Parse.Query(Reaction);
    query.equalTo('post', { __type: 'Pointer', className: 'Post', objectId: postId });
    
    try {
        const reactions = await query.find();
        const reactionsCountElement = document.getElementById(`reactions-count-${postId}`);
        if (reactionsCountElement) {
            reactionsCountElement.textContent = reactions.length;
        }
    } catch (error) {
        console.error("Erro ao carregar reações:", error);
    }
}

/**
 * Alterna a visibilidade da seção de comentários de uma postagem.
 * @param {string} postId - O ID da postagem.
 */
function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-section-${postId}`);
    if (commentsSection) {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        // Se a seção de comentários for aberta, atualiza o avatar do usuário no formulário.
        if (commentsSection.style.display === 'block') {
            updateCommentAvatar(postId);
        }
    }
}

/**
 * Lida com o evento de input na área de texto do comentário,
 * ativando ou desativando o botão de envio com base no conteúdo.
 * @param {string} postId - O ID da postagem.
 */
function handleCommentInput(postId) {
    const textarea = document.getElementById(`comment-input-${postId}`);
    const sendBtn = document.getElementById(`comment-send-btn-${postId}`);
    if (textarea && sendBtn) {
        sendBtn.disabled = textarea.value.trim() === '';
    }
}

/**
 * Exibe uma notificação "toast" na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de toast ('success', 'error', 'info').
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Mostra o toast com uma transição.
    setTimeout(() => { toast.classList.add('show'); }, 100);
    // Esconde o toast após 3 segundos.
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
    // Remove o toast do DOM após a transição de saída.
    setTimeout(() => { if (document.body.contains(toast)) document.body.removeChild(toast); }, 3300);
}

/**
 * Calcula e retorna uma string representando o tempo decorrido desde uma data.
 * Ex: "agora", "5 min atrás", "2h atrás", "3d atrás", "10/05/2023".
 * @param {Date|string} date - A data a ser formatada.
 * @returns {string} A string de tempo decorrido.
 */
function getTimeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);
    if (diffInSeconds < 60) return 'agora';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min atrás`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d atrás`;
    
    return past.toLocaleDateString('pt-BR');
}

/**
 * Atualiza as informações do usuário (nome e avatar) no cabeçalho e no input de postagem.
 */
function updateUserHeader() {
    if (!currentUser) return;

    const userName = currentUser.get('name') || currentUser.get('username') || 'Usuário';
    const userAvatarImg = document.getElementById('user-avatar-img');
    const userAvatarLetter = document.getElementById('user-avatar-letter');
    const userNameElement = document.getElementById('user-name');
    const postUserAvatarImg = document.getElementById('post-user-avatar-img');
    const postUserAvatarLetter = document.getElementById('post-user-avatar-letter');

    if (userNameElement) userNameElement.textContent = userName;

    // Prioriza a foto de perfil enviada, depois a do Google/outros, por fim um avatar gerado.
    let avatarUrl = currentUser.get('picture') || (currentUser.get('profilePicture') && currentUser.get('profilePicture').url());
    
    if (avatarUrl) {
        if (userAvatarImg) {
            userAvatarImg.src = avatarUrl;
            userAvatarImg.style.display = 'block';
        }
        if (userAvatarLetter) userAvatarLetter.style.display = 'none';

        if (postUserAvatarImg) {
            postUserAvatarImg.src = avatarUrl;
            postUserAvatarImg.style.display = 'block';
        }
        if (postUserAvatarLetter) postUserAvatarLetter.style.display = 'none';
    } else {
        const initial = userName.charAt(0).toUpperCase();
        if (userAvatarLetter) userAvatarLetter.textContent = initial;
        if (userAvatarImg) userAvatarImg.style.display = 'none';
        if (userAvatarLetter) userAvatarLetter.style.display = 'block';

        if (postUserAvatarLetter) postUserAvatarLetter.textContent = initial;
        if (postUserAvatarImg) postUserAvatarImg.style.display = 'none';
        if (postUserAvatarLetter) postUserAvatarLetter.style.display = 'block';
    }
}

/**
 * Realiza o logout do usuário e o redireciona para a página de login.
 */
async function logout() {
    try {
        await Parse.User.logOut();
        // Redireciona para a página de login externa (que você deve ter configurado).
        window.location.href = 'index.html'; 
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showToast('Erro ao fazer logout. Tente novamente.', 'error');
    }
}

// --- Funções de Gerenciamento de Avisos (Admin-Only) ---
// Estas funções são placeholders. A lógica completa para criar e gerenciar avisos
// deve ser implementada em uma página ou sistema de administração separado.

/**
 * Exibe um modal ou formulário para criar um novo aviso de administrador.
 * (Funcionalidade em desenvolvimento/externa)
 */
function showCreateNoticeModal() {
    showToast('Funcionalidade de criar aviso (admin) em desenvolvimento!', 'info');
    // Implemente a lógica para abrir um modal ou redirecionar para a página de criação de aviso.
}

/**
 * Exibe um modal ou página para gerenciar avisos existentes de administrador.
 * (Funcionalidade em desenvolvimento/externa)
 */
function showManageNoticesModal() {
    showToast('Funcionalidade de gerenciar avisos (admin) em desenvolvimento!', 'info');
    // Implemente a lógica para abrir um modal ou redirecionar para a página de gerenciamento de avisos.
}

// Torna as funções globais para que possam ser chamadas diretamente do HTML.
window.openPostModal = openPostModal;
window.closePostModal = closePostModal;
window.submitPost = submitPost;
window.logout = logout;
window.showCreateNoticeModal = showCreateNoticeModal;
window.showManageNoticesModal = showManageNoticesModal;
window.addReaction = addReaction;
window.toggleComments = toggleComments;
window.handleCommentInput = handleCommentInput;
window.addComment = addComment;
