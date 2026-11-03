'use client';
import { useState } from 'react';
import { ErrorAlert, Field, useAction } from './ui';
import { api } from '@/lib/api';

export interface NewCustomerResult {
  id: string;
  addressId: string | null;
  equipmentId: string | null;
}

const empty = {
  name: '',
  phone: '',
  email: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  postalCode: '',
  accessNotes: '',
  equipment: '',
  brand: '',
  model: '',
  capacityBtu: '',
};

/** Cadastro rápido de cliente + local + equipamento (brief 8.1, tela 6). */
export function CustomerForm({
  apiPath,
  onCreated,
}: {
  apiPath: string;
  onCreated: (r: NewCustomerResult) => void;
}) {
  const [v, setV] = useState(empty);
  const set =
    (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));
  const action = useAction(async () => {
    const r = await api<NewCustomerResult>(apiPath, {
      method: 'POST',
      json: {
        name: v.name,
        phone: v.phone || undefined,
        email: v.email || undefined,
        address: {
          street: v.street,
          number: v.number || undefined,
          complement: v.complement || undefined,
          district: v.district || undefined,
          city: v.city,
          state: v.state,
          postalCode: v.postalCode || undefined,
          accessNotes: v.accessNotes || undefined,
        },
        equipment: {
          description: v.equipment,
          brand: v.brand || undefined,
          model: v.model || undefined,
          capacityBtu: v.capacityBtu ? Number(v.capacityBtu) : undefined,
        },
      },
    });
    onCreated(r);
  });
  const err = action.error;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run();
      }}
    >
      <ErrorAlert error={err} />
      <div className="grid2">
        <Field label="Nome do cliente *" name="name" error={err}>
          <input id="name" required value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Telefone" name="phone" error={err}>
          <input id="phone" inputMode="tel" value={v.phone} onChange={set('phone')} />
        </Field>
        <Field label="E-mail (para receber orçamentos)" name="email" error={err}>
          <input id="email" type="email" value={v.email} onChange={set('email')} />
        </Field>
      </div>
      <h3>Local de atendimento</h3>
      <div className="grid2">
        <Field label="Rua *" name="address.street" error={err}>
          <input id="address.street" required value={v.street} onChange={set('street')} />
        </Field>
        <Field label="Número" name="address.number" error={err}>
          <input id="address.number" value={v.number} onChange={set('number')} />
        </Field>
        <Field label="Complemento" name="address.complement" error={err}>
          <input id="address.complement" value={v.complement} onChange={set('complement')} />
        </Field>
        <Field label="Bairro" name="address.district" error={err}>
          <input id="address.district" value={v.district} onChange={set('district')} />
        </Field>
        <Field label="Cidade *" name="address.city" error={err}>
          <input id="address.city" required value={v.city} onChange={set('city')} />
        </Field>
        <Field label="UF *" name="address.state" error={err}>
          <input
            id="address.state"
            required
            maxLength={2}
            value={v.state}
            onChange={set('state')}
          />
        </Field>
        <Field label="CEP" name="address.postalCode" error={err}>
          <input
            id="address.postalCode"
            inputMode="numeric"
            value={v.postalCode}
            onChange={set('postalCode')}
          />
        </Field>
        <Field label="Instruções de acesso" name="address.accessNotes" error={err}>
          <input id="address.accessNotes" value={v.accessNotes} onChange={set('accessNotes')} />
        </Field>
      </div>
      <h3>Equipamento</h3>
      <div className="grid2">
        <Field label="Descrição *" name="equipment.description" error={err}>
          <input
            id="equipment.description"
            required
            placeholder="Ex.: Split da sala"
            value={v.equipment}
            onChange={set('equipment')}
          />
        </Field>
        <Field label="Marca" name="equipment.brand" error={err}>
          <input id="equipment.brand" value={v.brand} onChange={set('brand')} />
        </Field>
        <Field label="Modelo" name="equipment.model" error={err}>
          <input id="equipment.model" value={v.model} onChange={set('model')} />
        </Field>
        <Field label="Capacidade (BTU)" name="equipment.capacityBtu" error={err}>
          <input
            id="equipment.capacityBtu"
            inputMode="numeric"
            value={v.capacityBtu}
            onChange={set('capacityBtu')}
          />
        </Field>
      </div>
      <button disabled={action.pending}>{action.pending ? 'Salvando…' : 'Salvar cliente'}</button>
    </form>
  );
}
