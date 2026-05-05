
import { createClient } from '@supabase/supabase-js';

/**
 * --- INSTRUÇÕES PARA O ADMINISTRADOR ---
 * 
 * 1. COMO RESOLVER O E-MAIL QUE NÃO CHEGA:
 *    No painel do Supabase, vá em: Authentication -> Providers -> Email
 *    E DESATIVE a opção "Confirm email". Clique em SAVE.
 * 
 * 2. SQL PARA TUTORIAIS EM VÍDEO:
 *    Execute no SQL Editor:
 *    create table tutorial_levels (id uuid default gen_random_uuid() primary key, name text not null, color text default 'text-white', bg_color text default 'bg-red-600', sort_order int default 0);
 *    create table tutorial_modules (id uuid default gen_random_uuid() primary key, level_id uuid references tutorial_levels(id) on delete cascade, name text not null, sort_order int default 0);
 *    create table tutorial_lessons (id uuid default gen_random_uuid() primary key, module_id uuid references tutorial_modules(id) on delete cascade, title text not null, description text, video_url text not null, sort_order int default 0);
 *    alter table tutorial_levels enable row level security; alter table tutorial_modules enable row level security; alter table tutorial_lessons enable row level security;
 *    create policy "Public read levels" on tutorial_levels for select using (true);
 *    create policy "Public read modules" on tutorial_modules for select using (true);
 *    create policy "Public read lessons" on tutorial_lessons for select using (true);
 * 
 * 3. SQL PARA PERFIS E ACESSO PRO (NOVO):
 *    Execute para permitir gerenciamento manual de assinaturas:
 * 
 *    create table public.profiles (
 *      id uuid references auth.users on delete cascade primary key,
 *      is_pro boolean default false,
 *      stripe_customer_id text,
 *      updated_at timestamp with time zone default now()
 *    );
 *    
 *    -- Gatilho para criar perfil automaticamente no cadastro
 *    create function public.handle_new_user() returns trigger as $$
 *    begin
 *      insert into public.profiles (id, is_pro) values (new.id, false);
 *      return new;
 *    end; $$ language plpgsql security definer;
 *    
 *    create trigger on_auth_user_created after insert on auth.users
 *      for each row execute procedure public.handle_new_user();
 *
 *    -- Habilitar RLS e Permissões (CRITICAL para aparecer como PRO)
 *    alter table public.profiles enable row level security;
 *    create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
 *
 *    -- Habilitar Realtime (Para o App atualizar na hora sem precisar dar F5)
 *    -- 1. Vá em: Database -> Replication
 *    -- 2. No card 'supabase_realtime', clique no número na coluna 'Source' (ex: '0 tables')
 *    -- 3. Habilite o interruptor da tabela 'profiles' e clique em Save.
 *
 *    -- PARA DAR PRO MANUALMENTE:
 *    -- Vá em Table Editor -> profiles -> Mude is_pro para true na linha do usuário.
 *
 * 4. SQL PARA LIMITE DE IMPRESSÃO (NOVO):
 *    Execute para sincronizar o limite entre dispositivos:
 *
 *    create table public.print_usage (
 *      user_id uuid references auth.users on delete cascade,
 *      month_year text not null,
 *      count int default 0,
 *      primary key (user_id, month_year)
 *    );
 *    alter table public.print_usage enable row level security;
 *    create policy "Users can manage their own print usage" on public.print_usage 
 *      for all using (auth.uid() = user_id);
5. SQL PARA SALVAR TOM DO HINO (NOVO):
 *    Execute no SQL Editor do Supabase para configurar a tabela de preferências:
 *
 *    -- Recomendado: Limpar tabela anterior se houver conflito de tipo
 *    DROP TABLE IF EXISTS public.hymn_settings;
 *
 *    CREATE TABLE public.hymn_settings (
 *      user_id uuid references auth.users on delete cascade,
 *      hymn_id text not null, 
 *      transpose_count int default 0,
 *      updated_at timestamp with time zone default now(),
 *      primary key (user_id, hymn_id)
 *    );
 *
 *    ALTER TABLE public.hymn_settings ENABLE ROW LEVEL SECURITY;
 *
 *    CREATE POLICY "Users can manage their own hymn settings" ON public.hymn_settings 
 *      FOR ALL USING (auth.uid() = user_id);
 *
 *    -- NOTA: Se a tabela já existir e nada aparecer, execute:
 *    -- ALTER TABLE public.hymn_settings ALTER COLUMN hymn_id TYPE text;
 */

const getSupabase = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  // Default values as fallback
  let url = 'https://wryzekymvujylcrexlji.supabase.co';
  let key = 'sb_publishable_urGvejQzLCnBcP81zIwBng_rcVlgMjh';

  // Smart detection: assign provided values based on their format pattern
  const providedValues = [envUrl, envKey].filter(Boolean);
  for (const v of providedValues) {
    if (v.startsWith('http')) {
      url = v;
    } else if (v.startsWith('sb_') || v.startsWith('eyJ')) {
      key = v;
    }
  }

  // Final check to prevent obvious crashes, though defaults should be safe
  try {
    new URL(url);
    console.log('📡 Supabase conectado em:', url);
  } catch (e) {
    console.error('Supabase URL is invalid, falling back to default.');
    url = 'https://wryzekymvujylcrexlji.supabase.co';
  }

  return createClient(url, key);
};

export const supabase = getSupabase();
