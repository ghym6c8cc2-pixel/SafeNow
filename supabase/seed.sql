-- Reference data only; no auth users, passwords or real incidents.
insert into public.categories(id,name,description,default_risk,icon) values
('robbery','Roubo','Relato de roubo com ameaça',4,'◆'),
('theft','Furto','Subtração sem ameaça relatada',2,'◇'),
('accident','Acidente','Ocorrência de trânsito',3,'▲'),
('fire','Incêndio','Fogo ou fumaça',4,'!'),
('violence','Violência','Situação de violência relatada',4,'!'),
('blocked','Via bloqueada','Interdição ou obstáculo na via',2,'▬'),
('missing','Pessoa desaparecida','Evite dados pessoais; procure canais oficiais',3,'?'),
('animal','Animal perdido','Animal relatado pela comunidade',1,'●'),
('other','Outra ocorrência','Informação comunitária',2,'+')
on conflict(id) do nothing;
