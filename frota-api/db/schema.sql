-- DDL da frota-api. Compatível com PostgreSQL e com o SQLite usado nos testes.
-- Convenção do time: nomes em português, snake_case, chave primária "id" ou natural documentada.

CREATE TABLE aeronaves (
    matricula      VARCHAR(6)   PRIMARY KEY,          -- ex.: PR-ABC (formato ANAC)
    modelo         VARCHAR(40)  NOT NULL,             -- ex.: E195-E2
    numero_serie   VARCHAR(20)  NOT NULL UNIQUE,
    operador       VARCHAR(60)  NOT NULL,
    status         VARCHAR(12)  NOT NULL DEFAULT 'ativa'
                   CHECK (status IN ('ativa', 'manutencao', 'inativa')),
    criado_em      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voos (
    id             INTEGER      PRIMARY KEY,
    matricula      VARCHAR(6)   NOT NULL REFERENCES aeronaves (matricula),
    origem         CHAR(4)      NOT NULL,             -- código ICAO, ex.: SBGR
    destino        CHAR(4)      NOT NULL,
    decolagem_em   TIMESTAMP    NOT NULL,             -- UTC
    pouso_em       TIMESTAMP    NOT NULL,             -- UTC
    horas_voo      NUMERIC(6,2) NOT NULL CHECK (horas_voo >= 0),
    ciclos         INTEGER      NOT NULL DEFAULT 1 CHECK (ciclos >= 0)
);

CREATE INDEX idx_voos_matricula_decolagem ON voos (matricula, decolagem_em);

CREATE TABLE manutencoes (
    id                     INTEGER      PRIMARY KEY,
    matricula              VARCHAR(6)   NOT NULL REFERENCES aeronaves (matricula),
    tipo                   VARCHAR(20)  NOT NULL CHECK (tipo IN ('preventiva', 'corretiva', 'inspecao')),
    descricao              VARCHAR(200) NOT NULL,
    realizada_em           DATE         NOT NULL,
    responsavel_matricula  VARCHAR(10)  NOT NULL      -- matrícula do mecânico: dado pessoal (LGPD), não expor na API
);
