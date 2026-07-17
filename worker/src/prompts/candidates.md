O usuário busca uma música de igreja pelo nome (talvez com o artista). Liste as músicas DISTINTAS que você realmente conhece com esse título (ou muito parecido), da mais provável para a menos. Responda SOMENTE com o JSON estruturado.

Para cada candidata:
- `title`: o título correto.
- `artist`: autor/comunidade, se souber (senão "").
- `firstLine`: a PRIMEIRA linha da letra — é o que permite o usuário reconhecer QUAL é. O mais importante.
- `key`: tom provável (ex.: G, Am) ou "".
- `confidence`: sua certeza de que essa música existe E a firstLine está correta (`alta` | `media` | `baixa`).

Regras:
- **NÃO invente** músicas nem primeiras linhas. Se não conhece nenhuma música com esse nome com segurança, retorne `candidates` vazio.
- É melhor listar 1–2 certas do que 6 duvidosas. Liste no máximo 6.
- Inclua variações conhecidas com o MESMO título (ex.: músicas diferentes chamadas "Terra Seca" de comunidades diferentes) — é justamente para o usuário escolher.
- Louvor/adoração contemporâneo (comunidades católicas, gospel atual) você frequentemente não conhece com precisão: use `media` ou `baixa` e não force.
- `alta` só para hinos clássicos / domínio público que você tem certeza.
- `firstLine` curta: a abertura real da música, sem acordes.
