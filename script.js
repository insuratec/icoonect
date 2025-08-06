// Posts data
let postsData = [];
let apiConfig = {
    url: '',
    appId: '',
    restKey: ''
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadApiConfig();
});

// Mostrar alertas
function showAlert(message, type) {
    const alertsContainer = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertsContainer.appendChild(alert);
    
    // Remover alerta após 5 segundos
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Fetch posts from iConnect API
async function fetchPosts() {
    console.log('🚀 FUNCTION STARTED: fetchPosts()');
    
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const appId = document.getElementById('appId').value.trim();
    const restKey = document.getElementById('restKey').value.trim();

    console.log('=== iConnect API Fetch Started ===');
    console.log('API URL:', apiUrl);
    console.log('App ID:', appId);
    console.log('REST Key:', restKey ? '[HIDDEN]' : '[EMPTY]');

    if (!apiUrl || !appId || !restKey) {
        console.log('❌ Missing required API configuration');
        showAlert('Por favor, preencha todos os campos da API (URL, App ID e REST Key)', 'error');
        return;
    }

    // Save API config
    apiConfig = { url: apiUrl, appId: appId, restKey: restKey };
    localStorage.setItem('apiConfig', JSON.stringify(apiConfig));

    const postsContainer = document.getElementById('postsContainer');
    const postsSection = document.getElementById('postsSection');
    const postsCount = document.getElementById('postsCount');

    // Show loading
    postsContainer.innerHTML = '<div class="loading">🔄 Carregando posts...</div>';
    postsSection.style.display = 'block';
    postsSection.scrollIntoView({ behavior: 'smooth' });

    const headers = {
        'X-Parse-Application-Id': appId,
        'X-Parse-REST-API-Key': restKey,
        'Content-Type': 'application/json'
    };

    console.log('📡 Making API request...');
    console.log('Request Headers:', {
        'X-Parse-Application-Id': appId,
        'X-Parse-REST-API-Key': '[HIDDEN]',
        'Content-Type': 'application/json'
    });

    try {
        // Fetch posts with included user data and comments with their users
        const postsUrl = new URL(apiUrl);
        // Include user data for posts and comments data with user info for each comment
        postsUrl.searchParams.set('include', 'user,comments.user');
        postsUrl.searchParams.set('limit', '100'); // Increase limit if needed
        
        console.log('📡 Fetching posts with user data and comments with user data...');
        console.log('Posts URL with include:', postsUrl.toString());
        
        const response = await fetch(postsUrl.toString(), {
            method: 'GET',
            headers: headers
        });

        console.log('📨 Response received:');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            console.log('❌ Response not OK');
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('📋 Raw API Response:', data);
        
        postsData = data.results || [];
        console.log('📊 Processed Posts Array:', postsData);
        console.log('📈 Posts Count:', postsData.length);

        // Process comments that are already included
        console.log('DEBUG: Processing posts comments...');
        console.log('DEBUG: Posts data:', postsData);
        
        postsData.forEach((post, postIndex) => {
            console.log('DEBUG: Post', postIndex + 1, 'ID:', post.objectId);
            console.log('DEBUG: Post comments:', post.comments);
            
            if (post.comments && Array.isArray(post.comments)) {
                console.log('DEBUG: Found', post.comments.length, 'comments');
                
                post.comments.forEach((comment, commentIndex) => {
                    console.log('DEBUG: Comment', commentIndex + 1, ':', comment);
                    if (comment.user) {
                        console.log('DEBUG: Comment user:', comment.user);
                    } else {
                        console.log('DEBUG: No user in comment');
                    }
                });
                
                // Check if comments are fully populated objects or just IDs
                const hasDetailedComments = post.comments.length > 0 && 
                    typeof post.comments[0] === 'object' && 
                    post.comments[0].hasOwnProperty('createdAt');
                
                if (hasDetailedComments) {
                    post.detailedComments = post.comments;
                    console.log('DEBUG: Comments are detailed objects');
                } else {
                    post.detailedComments = [];
                    console.log('DEBUG: Comments are just IDs or empty');
                }
            } else {
                post.detailedComments = [];
                console.log('DEBUG: No comments found');
            }
        });

        if (postsData.length === 0) {
            console.log('📭 No posts found');
            postsContainer.innerHTML = '<div class="loading">📭 Nenhum post encontrado</div>';
            postsCount.textContent = 'Total: 0 posts';
        } else {
            console.log('✅ Displaying posts...');
            displayPosts(postsData);
            postsCount.textContent = `Total: ${postsData.length} posts`;
        }

        showAlert(`${postsData.length} posts carregados com sucesso!`, 'success');
        console.log('=== iConnect API Fetch Completed Successfully ===');

    } catch (error) {
        console.error('❌ Error fetching posts:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        postsContainer.innerHTML = `<div class="loading">❌ Erro ao carregar posts: ${error.message}</div>`;
        postsCount.textContent = 'Erro ao carregar';
        showAlert(`Erro ao buscar posts: ${error.message}`, 'error');
        console.log('=== iConnect API Fetch Failed ===');
    }
}

// Display posts in the UI
function displayPosts(posts) {
    console.log('DEBUG: Starting displayPosts');
    console.log('DEBUG: Posts received:', posts);
    
    const postsContainer = document.getElementById('postsContainer');
    
    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = '<div class="loading">📭 Nenhum post encontrado</div>';
        return;
    }

    const postsHtml = posts.map(post => {
        const createdAt = new Date(post.createdAt).toLocaleString('pt-BR');
        const userName = post.userName || 'Usuário Anônimo';
        const userInitial = userName.charAt(0).toUpperCase();
        const content = post.content || 'Sem conteúdo';
        const likes = post.likes || 0;
        const views = post.views || 0;
        const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
        const detailedCommentsCount = Array.isArray(post.detailedComments) ? post.detailedComments.length : 0;
        const postType = post.postType || 'padrão';
        const audience = post.audience || 'público';

        // Generate comments HTML with user pictures
        let commentsHtml = '';
        if (post.detailedComments && post.detailedComments.length > 0) {
            commentsHtml = `
                <div class="comments-section">
                    <h4 style="margin: 15px 0 10px 0; color: #2c3e50; font-size: 1rem;">💬 Comentários (${detailedCommentsCount})</h4>
                    ${post.detailedComments.map(comment => {
                        const commentDate = new Date(comment.createdAt).toLocaleString('pt-BR');
                        const commentUser = comment.user || {};
                        const commentUserName = commentUser.username || commentUser.name || commentUser.firstName || 'Usuário Anônimo';
                        const commentUserInitial = commentUserName.charAt(0).toUpperCase();
                        const commentContent = comment.content || 'Sem conteúdo';
                        const commentLikes = comment.likes || 0;
                        
                        console.log('DEBUG: Rendering comment');
                        console.log('DEBUG: Comment:', comment);
                        console.log('DEBUG: Comment user:', commentUser);
                        console.log('DEBUG: Final name:', commentUserName);
                        
                        // Check if user has a profile picture - try multiple possible field names
                        let userAvatarHtml = `<div class="comment-avatar">${commentUserInitial}</div>`;
                        const possiblePictureFields = ['profilePicture', 'picture', 'avatar', 'photo', 'image'];
                        let pictureUrl = null;
                        
                        for (const field of possiblePictureFields) {
                            if (commentUser[field]) {
                                pictureUrl = commentUser[field];
                                break;
                            }
                        }
                        
                        if (pictureUrl) {
                            userAvatarHtml = `<img src="${pictureUrl}" alt="${commentUserName}" class="comment-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                             <div class="comment-avatar" style="display: none;">${commentUserInitial}</div>`;
                            console.log('🖼️ Using picture URL:', pictureUrl);
                        } else {
                            console.log('📷 No picture found for user, using initials');
                        }

                        return `
                            <div class="comment-item">
                                <div class="comment-header">
                                    ${userAvatarHtml}
                                    <div class="comment-user-info">
                                        <div class="comment-username">${commentUserName}</div>
                                        <div class="comment-date">${commentDate}</div>
                                    </div>
                                    ${commentLikes > 0 ? `<div class="comment-likes">👍 ${commentLikes}</div>` : ''}
                                </div>
                                <div class="comment-content">${commentContent}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        return `
            <div class="post-item">
                <div class="post-header">
                    <div class="post-avatar">${userInitial}</div>
                    <div class="post-user-info">
                        <div class="post-username">${userName}</div>
                        <div class="post-date">${createdAt}</div>
                    </div>
                    <div class="post-type-badge">${postType}</div>
                </div>
                <div class="post-content">${content}</div>
                <div class="post-stats">
                    <div class="post-stat">
                        <span>👍</span>
                        <span>${likes} likes</span>
                    </div>
                    <div class="post-stat">
                        <span>👁️</span>
                        <span>${views} views</span>
                    </div>
                    <div class="post-stat">
                        <span>💬</span>
                        <span>${detailedCommentsCount} comentários</span>
                    </div>
                    <div class="post-stat">
                        <span>🌐</span>
                        <span>${audience}</span>
                    </div>
                </div>
                ${commentsHtml}
            </div>
        `;
    }).join('');

    postsContainer.innerHTML = postsHtml;
    console.log('DEBUG: Display posts completed');
}

// Clear posts display
function clearPosts() {
    postsData = [];
    const postsContainer = document.getElementById('postsContainer');
    const postsSection = document.getElementById('postsSection');
    const postsCount = document.getElementById('postsCount');
    
    postsContainer.innerHTML = '';
    postsSection.style.display = 'none';
    postsCount.textContent = '';
    
    showAlert('Posts limpos!', 'success');
}

// Load API configuration
function loadApiConfig() {
    try {
        const savedConfig = localStorage.getItem('apiConfig');
        if (savedConfig) {
            apiConfig = JSON.parse(savedConfig);
            document.getElementById('apiUrl').value = apiConfig.url || '';
            document.getElementById('appId').value = apiConfig.appId || '';
            document.getElementById('restKey').value = apiConfig.restKey || '';
        }
    } catch (error) {
        console.error('Error loading API config:', error);
    }
} 
