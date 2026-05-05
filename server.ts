import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing');
  return new Stripe(key);
};

const getSupabaseAdmin = () => {
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Known good defaults for this project
  let url = 'https://wryzekymvujylcrexlji.supabase.co';
  let key = envServiceKey || ''; // Can't fallback for secret key, but we want to avoid crashing

  // If one of the env vars looks like a URL, use it as the URL
  if (envUrl && envUrl.startsWith('http')) {
    url = envUrl;
  } else if (envServiceKey && envServiceKey.startsWith('http')) {
    url = envServiceKey;
  }

  // If we don't have a valid service key yet, but one of the env vars looks like a key
  if (!envServiceKey || (!envServiceKey.startsWith('sb_') && !envServiceKey.includes('.'))) {
    if (envUrl && (envUrl.startsWith('sb_') || envUrl.includes('.'))) {
      key = envUrl;
    }
  }

  if (!url || !key) {
    throw new Error('Supabase configuration is incomplete. Please check VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, key);
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Webhook needs raw body for signature verification
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(
        req.body,
        sig || '',
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId = session.customer as string;

      if (userId) {
        const supabaseAdmin = getSupabaseAdmin();
        const { error } = await supabaseAdmin
          .from('profiles')
          .upsert({ id: userId, is_pro: true, stripe_customer_id: customerId });
        
        if (error) {
          console.error('Error updating profile:', error);
        } else {
          console.log(`User ${userId} upgraded to PRO`);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_pro: false })
        .eq('stripe_customer_id', customerId);
      
      if (error) console.error('Error downgrading profile:', error);
    }

    res.json({ received: true });
  });

  // Regular JSON parsing for other routes
  app.use(express.json());

  app.post('/api/create-checkout-session', async (req, res) => {
    const { userId, priceId } = req.body;

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.headers.origin}/?success=true`,
        cancel_url: `${req.headers.origin}/?canceled=true`,
        metadata: { userId },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/create-portal-session', async (req, res) => {
    const { customerId } = req.body;

    try {
      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: req.headers.origin,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
