import {
  SwaggerModule,
  DocumentBuilder,
  type SwaggerCustomOptions,
} from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

// ──────────────────────────────────────────────
// Description shown at the top of the Swagger page
// ──────────────────────────────────────────────
const SWAGGER_DESCRIPTION = [
  'API documentation for Q-Studieon',
  '',
  '---',
  '### \u{1F511} How to authenticate',
  '',
  '**1. Get your token** — Call one of these login endpoints:',
  '',
  '| Endpoint | Request body | Token location |',
  '|---|---|---|',
  '| `POST /api/v1/auth/user/login` | `{ "email": "...", "password": "..." }` | `response.data.token.accessToken` |',
  '| `POST /api/v1/auth/admin/login` | `{ "email": "...", "password": "..." }` | `response.data.tokens.accessToken` |',
  '| `POST /api/v1/auth/user/register` | `{ "name", "email", "password", ... }` | `response.data.token.accessToken` |',
  '| `POST /api/v1/auth/user/guest-login` | _(no body required — sends headers)_ | `response.data.accessToken` |',
  '| `POST /api/v1/auth/user/google-login` | `{ "token": "..." }` | `response.data.token.accessToken` |',
  '| `POST /api/v1/auth/user/apple-login` | `{ "token": "..." }` | `response.data.token.accessToken` |',
  '',
  '**2. Authorize** — Click the **Authorize** button at the top right, paste only the `accessToken` value (the JWT string), and click **Authorize**.',
  '',
  '**3. Test protected routes** — Locked endpoints will now send your token automatically.',
].join('\n');

// ──────────────────────────────────────────────
// Custom CSS injected into the Swagger UI page
// ──────────────────────────────────────────────
const SWAGGER_CUSTOM_CSS = `
  /* --- Auth status badge --- */
  .auth-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    margin-left: 12px;
    cursor: default;
    vertical-align: middle;
  }
  .auth-status-badge.authorized {
    background-color: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #a5d6a7;
  }
  .auth-status-badge.unauthorized {
    background-color: #fff3e0;
    color: #e65100;
    border: 1px solid #ffcc80;
  }
  .auth-status-badge .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  .auth-status-badge.authorized .dot {
    background-color: #2e7d32;
  }
  .auth-status-badge.unauthorized .dot {
    background-color: #e65100;
  }
  /* --- Clear Auth button --- */
  .btn-auth-clear {
    display: none;
    margin-left: 8px;
    padding: 5px 12px;
    border: 1px solid #d32f2f;
    background-color: #fff;
    color: #d32f2f;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    vertical-align: middle;
    transition: all 0.15s ease;
  }
  .btn-auth-clear:hover {
    background-color: #d32f2f;
    color: #fff;
  }
  .btn-auth-clear:active {
    transform: scale(0.96);
  }
`;

// ──────────────────────────────────────────────
// Custom JavaScript injected into the Swagger UI page
// ──────────────────────────────────────────────
const SWAGGER_CUSTOM_JS = `
(function() {
  'use strict';

  var UI_READY_POLL_MS = 300;
  var MAX_RETRIES = 20;

  function init(retries) {
    retries = retries || 0;
    if (retries >= MAX_RETRIES) return;

    var authBtn = document.querySelector('.auth-wrapper .authorize');
    var existing = document.getElementById('buff-auth-widget');
    if (!authBtn || existing) {
      setTimeout(function () { init(retries + 1); }, UI_READY_POLL_MS);
      return;
    }

    var wrapper = document.createElement('span');
    wrapper.id = 'buff-auth-widget';
    wrapper.style.cssText = 'display:inline-flex;align-items:center;margin-left:8px;';

    /* ---- Status badge ---- */
    var badge = document.createElement('span');
    badge.id = 'buff-badge';
    badge.className = 'auth-status-badge unauthorized';
    badge.innerHTML = '<span class="dot"></span> No token';

    /* ---- Clear button ---- */
    var clearBtn = document.createElement('button');
    clearBtn.id = 'buff-clear';
    clearBtn.className = 'btn-auth-clear';
    clearBtn.title = 'Remove the saved JWT token';
    clearBtn.textContent = '\\u2715 Clear';

    function clearAuth() {
      /* Clear all Swagger UI auth tokens from localStorage */
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.indexOf('authorized') !== -1 || key.indexOf('swagger') !== -1)) {
          localStorage.removeItem(key);
          i--;
        }
      }
      /* Also clear sessionStorage */
      for (var j = 0; j < sessionStorage.length; j++) {
        var sk = sessionStorage.key(j);
        if (sk && (sk.indexOf('authorized') !== -1 || sk.indexOf('swagger') !== -1)) {
          sessionStorage.removeItem(sk);
          j--;
        }
      }

      /* Update UI immediately after clearing storage */
      updateUI();

      /* Also click Logout through the modal to keep Swagger UI internal state in sync */
      var authorizeBtn = document.querySelector('.auth-wrapper .authorize');
      if (!authorizeBtn) return;

      authorizeBtn.click();

      /* Wait for modal to render, then click Logout and close */
      var modalObserver = new MutationObserver(function (mutations, obs) {
        var logoutBtn = document.querySelector('.auth-btn-wrapper .btn-done');
        if (!logoutBtn) return;
        if (logoutBtn.textContent.indexOf('Logout') === -1) return;

        logoutBtn.click();
        obs.disconnect();

        /* Dispatch Escape key to close the modal */
        setTimeout(function () {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
        }, 100);
      });
      modalObserver.observe(document.body, { childList: true, subtree: true });

      /* Safety: if modal never appears, bail after 3s */
      setTimeout(function () { modalObserver.disconnect(); }, 3000);
    }

    clearBtn.addEventListener('click', clearAuth);

    wrapper.appendChild(badge);
    wrapper.appendChild(clearBtn);
    authBtn.parentNode.insertBefore(wrapper, authBtn.nextSibling);

    function updateUI() {
      var hasAuth = false;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('authorized') !== -1) {
          var val = localStorage.getItem(key);
          if (val && val !== '{}' && val !== '[]') {
            hasAuth = true;
            break;
          }
        }
      }
      if (hasAuth) {
        badge.className = 'auth-status-badge authorized';
        badge.innerHTML = '<span class="dot"></span> Authenticated';
        clearBtn.style.display = 'inline-block';
      } else {
        badge.className = 'auth-status-badge unauthorized';
        badge.innerHTML = '<span class="dot"></span> No token';
        clearBtn.style.display = 'none';
      }
    }

    updateUI();

    /* Poll for auth changes (Swagger UI updates localStorage) */
    var lastAuth = JSON.stringify(getAuthKeys());
    function getAuthKeys() {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('authorized') !== -1) {
          keys.push({ k: key, v: localStorage.getItem(key) });
        }
      }
      return keys;
    }
    setInterval(function () {
      var now = JSON.stringify(getAuthKeys());
      if (now !== lastAuth) {
        lastAuth = now;
        updateUI();
      }
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(0); });
  } else {
    init(0);
  }
})();
`;

// ──────────────────────────────────────────────
// Swagger UI custom options
// ──────────────────────────────────────────────
const swaggerOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true,
    docExpansion: 'list',
  },
  customSiteTitle: 'Q-Studieon API Docs',
  customfavIcon: '/favicon.svg',
  customCss: SWAGGER_CUSTOM_CSS,
  customJsStr: SWAGGER_CUSTOM_JS,
};

// ──────────────────────────────────────────────
// Public setup function — call from main.ts
// ──────────────────────────────────────────────
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Q-Studieon API')
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: [
          'Paste your JWT access token here.',
          '',
          'To get a token:',
          '  \u2022 User login:  POST /api/v1/auth/user/login',
          '  \u2022 Admin login: POST /api/v1/auth/admin/login',
          '  \u2022 Register:    POST /api/v1/auth/user/register',
          '',
          'The token is in the response under data.token.accessToken (user) or data.tokens.accessToken (admin).',
        ].join('\n'),
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, swaggerOptions);
}
