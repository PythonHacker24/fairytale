"""Low-level Supabase client. Internal; use Market as the public entry point."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

_ENV_LOADED = False


def _load_env_once() -> None:
    """Load the project-root .env once per process."""
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    # Walk up from this file to find the project root that holds .env.
    here = Path(__file__).resolve().parent.parent
    env_path = here / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        # Fall back to default cwd resolution.
        load_dotenv()
    _ENV_LOADED = True


class SupabaseClient:
    """Process-wide Supabase client, lazily initialized.

    Reads credentials from environment in this order:
      * SUPABASE_URL              (required)
      * SUPABASE_SERVICE_ROLE_KEY (preferred for server-side / scripts)
      * SUPABASE_ANON_KEY         (fallback; subject to RLS)

    Pass url / key explicitly to override.
    """

    _client: Optional[Client] = None
    _url: Optional[str] = None

    @classmethod
    def get(cls, url: Optional[str] = None, key: Optional[str] = None) -> Client:
        if cls._client is not None and url is None and key is None:
            return cls._client

        _load_env_once()
        url = url or os.environ.get("SUPABASE_URL")
        key = (
            key
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
        )
        if not url or not key:
            raise RuntimeError(
                "Missing Supabase credentials. Set SUPABASE_URL and either "
                "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in the environment "
                "(or in a .env file at the project root)."
            )
        cls._client = create_client(url, key)
        cls._url = url
        return cls._client

    @classmethod
    def reset(cls) -> None:
        """Drop the cached client. For tests."""
        cls._client = None
        cls._url = None
