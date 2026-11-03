import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>ServiçoFlow</h1>
      <p className="muted">Pedidos, orçamentos e visitas de manutenção em um só lugar.</p>
      <div className="row">
        <Link className="button" href="/login">
          Entrar
        </Link>
        <Link className="button secondary" href="/status">
          Estado do sistema
        </Link>
      </div>
    </main>
  );
}
