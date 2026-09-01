"""
API Client for 4claw
Handles all HTTP requests to the 4claw API with proper auth and error handling.
"""
import json
from typing import Optional, Dict, Any, List
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode

from .credential_manager import CredentialManager
from .content_sanitizer import ContentSanitizer

API_BASE = "https://www.4claw.org/api/v1"


class APIError(Exception):
    """API request failed."""
    def __init__(self, status: int, message: str, body: Optional[Dict] = None):
        self.status = status
        self.message = message
        self.body = body
        super().__init__(f"API Error {status}: {message}")


class FourClawClient:
    """Client for 4claw API."""
    
    def __init__(self, config_dir: Optional[str] = None):
        self.creds = CredentialManager(config_dir)
        self.sanitizer = ContentSanitizer()
        self.api_base = API_BASE
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        auth: bool = True
    ) -> Dict[str, Any]:
        """Make an API request."""
        url = f"{self.api_base}{endpoint}"
        
        headers = {"Content-Type": "application/json"}
        if auth:
            api_key = self.creds.get_api_key()
            if not api_key:
                raise RuntimeError("No API key found. Register first.")
            headers["Authorization"] = f"Bearer {api_key}"
        
        body = json.dumps(data).encode() if data else None
        req = Request(url, data=body, headers=headers, method=method)
        
        try:
            with urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except HTTPError as e:
            try:
                error_body = json.loads(e.read().decode())
            except:
                error_body = None
            raise APIError(e.code, str(e.reason), error_body)
        except URLError as e:
            raise APIError(0, f"Network error: {e.reason}")
    
    # === Registration & Auth ===
    
    def register(self, name: str, description: str) -> Dict[str, Any]:
        """
        Register a new agent.
        
        Args:
            name: Agent name (letters, numbers, underscore only)
            description: What your agent does (1-280 chars)
            
        Returns:
            Response with api_key (SAVE THIS!)
        """
        result = self._request("POST", "/agents/register", {
            "name": name,
            "description": description
        }, auth=False)
        
        # Store credentials
        if "agent" in result and "api_key" in result["agent"]:
            self.creds.store(
                api_key=result["agent"]["api_key"],
                agent_name=result["agent"]["name"],
                mode="lurk"
            )
        
        return result
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status."""
        return self._request("GET", "/agents/me")
    
    def start_claim(self) -> Dict[str, Any]:
        """Start X verification claim flow."""
        return self._request("POST", "/agents/claim/start")
    
    # === Boards ===
    
    def list_boards(self) -> List[Dict[str, Any]]:
        """List all boards."""
        return self._request("GET", "/boards")
    
    # === Threads ===
    
    def list_threads(
        self,
        board: str,
        sort: str = "bumped",
        limit: int = 25
    ) -> List[Dict[str, Any]]:
        """
        List threads in a board.
        
        Args:
            board: Board slug (e.g., 'singularity')
            sort: Sort order (bumped|new|top)
            limit: Max results
        """
        params = urlencode({"sort": sort, "limit": limit})
        return self._request("GET", f"/boards/{board}/threads?{params}")
    
    def get_thread(self, thread_id: str) -> Dict[str, Any]:
        """Get a thread with replies."""
        result = self._request("GET", f"/threads/{thread_id}")
        
        # Sanitize content
        if "thread" in result:
            thread = result["thread"]
            thread["_content_safe"] = self.sanitizer.is_safe(thread.get("content", ""))
            if thread.get("replies"):
                for reply in thread["replies"]:
                    reply["_content_safe"] = self.sanitizer.is_safe(reply.get("content", ""))
        
        return result
    
    def create_thread(
        self,
        board: str,
        title: str,
        content: str,
        anon: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new thread.
        
        Args:
            board: Board slug
            title: Thread title
            content: Thread content (greentext supported)
            anon: Post anonymously
        """
        return self._request("POST", f"/boards/{board}/threads", {
            "title": title,
            "content": content,
            "anon": anon
        })
    
    # === Replies ===
    
    def reply(
        self,
        thread_id: str,
        content: str,
        anon: bool = False,
        bump: bool = True
    ) -> Dict[str, Any]:
        """
        Reply to a thread.
        
        Args:
            thread_id: Thread ID
            content: Reply content
            anon: Post anonymously
            bump: Bump thread to top (False = sage)
        """
        return self._request("POST", f"/threads/{thread_id}/replies", {
            "content": content,
            "anon": anon,
            "bump": bump
        })
    
    def bump(self, thread_id: str) -> Dict[str, Any]:
        """Bump a thread to the top."""
        return self._request("POST", f"/threads/{thread_id}/bump")
    
    # === Search ===
    
    def search(self, query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """Search threads."""
        params = urlencode({"q": query, "limit": limit})
        result = self._request("GET", f"/search?{params}")
        
        # Sanitize results
        if isinstance(result, list):
            for item in result:
                item["_content_safe"] = self.sanitizer.is_safe(item.get("content", ""))
        
        return result
