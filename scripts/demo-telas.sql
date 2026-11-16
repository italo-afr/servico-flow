-- Dados FICTÍCIOS para as capturas de tela (docs/screenshots). Só para banco local.
-- Uso, depois do seed: psql ... -f scripts/demo-telas.sql
-- Preenche a empresa fictícia "Clima Norte" com clientes, ordens em vários estados e visitas da semana.
DO $$
DECLARE
  org uuid;
  tz text;
  beto uuid;
  caio uuid;
  duda uuid;
  caio_m uuid;
  duda_m uuid;
  hoje timestamp;
  c record;
  cust uuid;
  addr uuid;
  eqp uuid;
  ord uuid;
  n int := 0;
BEGIN
  SELECT id, timezone INTO org, tz FROM organizations WHERE name LIKE 'Clima Norte%';
  IF EXISTS (SELECT 1 FROM service_orders WHERE organization_id = org) THEN
    RAISE NOTICE 'A empresa já tem ordens; nada foi feito.';
    RETURN;
  END IF;
  SELECT u.id INTO beto FROM "user" u WHERE u.email = 'beto@clima-norte.example.com';
  SELECT u.id, m.id INTO caio, caio_m FROM "user" u JOIN memberships m ON m.user_id = u.id AND m.organization_id = org WHERE u.email = 'caio@clima-norte.example.com';
  SELECT u.id, m.id INTO duda, duda_m FROM "user" u JOIN memberships m ON m.user_id = u.id AND m.organization_id = org WHERE u.email = 'duda@clima-norte.example.com';
  hoje := date_trunc('day', now() AT TIME ZONE tz);

  FOR c IN
    SELECT * FROM (VALUES
      ('Padaria Pão Quente',            '(11) 90000-0101', 'Rua das Flores',        '100',  'Centro',        'Split 12.000 BTU do salão',        'Não gela e pinga água no balcão.',                  'SCHEDULED',         'HIGH',   2, 'caio', 0,  9, 2),
      ('Clínica Vida Plena',            '(11) 90000-0102', 'Av. Brasil',            '2450', 'Jardim América','Cassete 36.000 BTU da recepção',   'Barulho alto ao ligar e cheiro forte.',             'SCHEDULED',         'NORMAL', 3, 'duda', 0, 10, 2),
      ('Mercado Bom Preço',             '(11) 90000-0103', 'Rua Sete de Setembro',  '81',   'Vila Nova',     'Câmara fria dos laticínios',       'Temperatura subindo durante a tarde.',              'IN_PROGRESS',       'URGENT', 1, 'caio', 0, 14, 3),
      ('Academia Corpo Ativo',          '(11) 90000-0104', 'Rua do Comércio',       '530',  'Centro',        'Piso-teto 48.000 BTU da musculação','Manutenção preventiva semestral.',                 'AWAITING_APPROVAL', 'NORMAL', 4, NULL,   0,  0, 0),
      ('Lima Contabilidade',            '(11) 90000-0105', 'Rua XV de Novembro',    '312',  'Centro',        'Split 9.000 BTU da sala 2',        'Controle remoto não responde.',                     'TRIAGE',            'LOW',    1, 'duda', 1,  9, 1),
      ('Restaurante Sabor Caseiro',     '(11) 90000-0106', 'Av. das Palmeiras',     '77',   'Boa Vista',     'Split 24.000 BTU do salão',        'Vazamento de água na parede.',                      'APPROVED',          'HIGH',   5, NULL,   0,  0, 0),
      ('Marina Souza',                  '(11) 90000-0107', 'Rua dos Ipês',          '45',   'Jardim Europa', 'Split 12.000 BTU do quarto',       'Instalação de aparelho novo.',                      'SCHEDULED',         'NORMAL', 2, 'duda', 3, 10, 2),
      ('Pet Shop Amigo Fiel',           '(11) 90000-0108', 'Rua Marechal Deodoro',  '900',  'Centro',        'Split 18.000 BTU do banho e tosa', 'Limpeza completa e troca de filtros.',              'COMPLETED',         'NORMAL', 8, NULL,   0,  0, 0),
      ('Farmácia Saúde Já',             '(11) 90000-0109', 'Av. Brasil',            '1200', 'Jardim América','Split 30.000 BTU da loja',         'Desliga sozinho depois de meia hora.',              'COMPLETED',         'HIGH',   6, NULL,   0,  0, 0),
      ('Escola Pequenos Passos',        '(11) 90000-0110', 'Rua das Acácias',       '18',   'Vila Nova',     'Seis splits das salas de aula',    'Contrato de manutenção: visita de novembro.',       'SCHEDULED',         'NORMAL', 3, 'caio', 4,  8, 3),
      ('Hotel Estação',                 '(11) 90000-0111', 'Praça da Matriz',       '5',    'Centro',        'Split 12.000 BTU do apto 204',     'Hóspede relatou que o ar não liga.',                'OPEN',              'URGENT', 0, NULL,   0,  0, 0),
      ('Oficina do Zeca',               '(11) 90000-0112', 'Rua Industrial',        '640',  'Distrito',      'Split 24.000 BTU do escritório',   'Orçamento para trocar o compressor.',               'AWAITING_APPROVAL', 'NORMAL', 2, NULL,   0,  0, 0),
      ('Salão Bela Forma',              '(11) 90000-0113', 'Rua do Comércio',       '212',  'Centro',        'Split 18.000 BTU do salão',        'Higienização antes do verão.',                      'COMPLETED',         'LOW',    12, NULL,  0,  0, 0),
      ('Consultório Dra. Paula Reis',   '(11) 90000-0114', 'Av. das Palmeiras',     '300',  'Boa Vista',     'Split 9.000 BTU da sala de espera','Pingando na sala de espera.',                       'TRIAGE',            'HIGH',   1, 'caio', 1, 14, 1)
    ) AS t(nome, fone, rua, num, bairro, equip, descr, status, prio, dias, tec, dia_visita, hora, dur)
  LOOP
    n := n + 1;
    INSERT INTO customers (organization_id, name, phone) VALUES (org, c.nome || ' (fictício)', c.fone) RETURNING id INTO cust;
    INSERT INTO service_addresses (organization_id, customer_id, street, number, district, city, state)
      VALUES (org, cust, c.rua, c.num, c.bairro, 'São Paulo', 'SP') RETURNING id INTO addr;
    INSERT INTO equipment (organization_id, customer_id, description) VALUES (org, cust, c.equip) RETURNING id INTO eqp;
    INSERT INTO service_orders (organization_id, number, customer_id, address_id, equipment_id, status, priority, description, created_by, assigned_user_id, created_at, updated_at, completed_at)
      VALUES (org, n, cust, addr, eqp, c.status, c.prio, c.descr, beto, beto,
              now() - make_interval(days => c.dias, hours => (n % 5)),
              now() - make_interval(hours => (n % 7)),
              CASE WHEN c.status = 'COMPLETED' THEN now() - make_interval(days => GREATEST(c.dias - 2, 0), hours => 3) END)
      RETURNING id INTO ord;
    INSERT INTO order_events (organization_id, order_id, type, actor_type, created_at)
      VALUES (org, ord, 'order.created', 'SYSTEM', now() - make_interval(days => c.dias, hours => (n % 5)));
    IF c.tec IS NOT NULL THEN
      INSERT INTO appointments (organization_id, order_id, technician_user_id, technician_membership_id, kind, status, starts_at, ends_at, started_at, created_by)
        VALUES (org, ord,
                CASE c.tec WHEN 'caio' THEN caio ELSE duda END,
                CASE c.tec WHEN 'caio' THEN caio_m ELSE duda_m END,
                CASE WHEN c.status = 'TRIAGE' THEN 'DIAGNOSTIC' ELSE 'EXECUTION' END,
                CASE WHEN c.status = 'IN_PROGRESS' THEN 'IN_PROGRESS' ELSE 'SCHEDULED' END,
                (hoje + make_interval(days => c.dia_visita, hours => c.hora)) AT TIME ZONE tz,
                (hoje + make_interval(days => c.dia_visita, hours => c.hora + c.dur)) AT TIME ZONE tz,
                CASE WHEN c.status = 'IN_PROGRESS' THEN (hoje + make_interval(days => c.dia_visita, hours => c.hora)) AT TIME ZONE tz END,
                beto);
    END IF;
  END LOOP;
  INSERT INTO order_counters (organization_id, last_number) VALUES (org, n)
    ON CONFLICT (organization_id) DO UPDATE SET last_number = EXCLUDED.last_number;
  RAISE NOTICE 'Criadas % ordens fictícias.', n;
END $$;
