import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const API_HOST = 'instagram-scraper-api2.p.rapidapi.com';
const API_KEY = '00b1c81042msh7497f39eace171ap1afa1bjsn5c2db77e4674'; // Sua chave de API

app.use(cors());


const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

const imageFolder = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imageFolder)) {
    fs.mkdirSync(imageFolder, { recursive: true });
}

// Função que retorna uma Promise para buscar e salvar a imagem do perfil de um seguidor
const downloadProfileImage = (profileImageUrl, username) => {
    return new Promise(async (resolve, reject) => {
        try {
            const imageResponse = await fetch(profileImageUrl);
            if (!imageResponse.ok) {
                reject(new Error('Failed to download image'));
                return;
            }

            const imageBuffer = await imageResponse.buffer();
            const imagePath = path.join(imageFolder, `${username}_profile.jpg`);
            fs.writeFileSync(imagePath, imageBuffer);
            resolve(imagePath); // Resolve a Promise com o caminho da imagem
        } catch (error) {
            reject(error); // Rejeita a Promise em caso de erro
        }
    });
};

// Função que retorna uma Promise para buscar os seguidores do perfil
const fetchFollowers = (username) => {
    return new Promise(async (resolve, reject) => {
        try {
            
            const response = await fetch(`https://${API_HOST}/v1/followers?username_or_id_or_url=${username}`, {
                method: 'GET',
                headers: {
                    'x-rapidapi-host': API_HOST,
                    'x-rapidapi-key': API_KEY,
                    'x-rapidapi-ua': "RapidAPI-Playground",
                },
            });

            if (!response.ok) {
                reject(new Error('Failed to fetch followers'));
                return;
            }

            const dataa = await response.json();
            const data = dataa.data;
            
            // Para cada seguidor no objeto 'items', baixar a imagem de perfil
            const followersWithImages = await Promise.all(
                data.items.map(async (follower) => {
                    if (follower.profile_pic_url) {
                        try {
                            const imagePath = await downloadProfileImage(follower.profile_pic_url, follower.username);
                            follower.profile_pic_local_path = `/images/${username}_profile.jpg`;
                        } catch (error) {
                        }
                    }
                    return follower; // Retorna o seguidor, com o caminho da imagem (se disponível)
                })
            );
            
            data.items = followersWithImages; // Substitui o objeto 'items' com os seguidores com imagem
            resolve(data); // Resolve a Promise com os dados dos seguidores (incluindo imagem)
        } catch (error) {
            reject(error); // Rejeita a Promise em caso de erro
        }
    });
};

app.get('/api/instagram', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        // Requisição para obter as informações do perfil
        const response = await fetch(`https://${API_HOST}/v1/info?username_or_id_or_url=${username}&amount=20`, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY,
            },
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch data from API' });
        }

        const data = await response.json();

        if(data.data.is_private == true){
            return res.status(response.status).json({ error: 'O perfil precisa ser público!' });
        }
        // Baixar imagem do perfil se disponível
        const profileImageUrl = data.data.profile_pic_url;
        if (profileImageUrl) {
                const imagePath = await downloadProfileImage(profileImageUrl, username); // Espera a Promise resolver
                data.data.profile_pic_local_path = `/images/${username}_profile.jpg`;
            }

        // Requisição para obter os seguidores do perfil
        try {
            const followersData = await fetchFollowers(username);
            data.data.followers = followersData.items; // Inclui os seguidores no retorno
        } catch (error) {
            return res.status(500).json({ error: 'Failed to fetch followers', details: error.message });
        }

        res.json(data); // Retorna as informações do perfil com seguidores e imagem
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log("Proxy is running on port 3000");
  });