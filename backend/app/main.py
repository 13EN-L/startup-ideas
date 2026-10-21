"""FastAPI service that holds the Claude key and labels study sessions."""
import hmac
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException

from app.contracts import LabelRequest, LabelResponse, PhotoCheckRequest, PhotoCheckResponse
from app.labeling import label_session
from app.photo import check_photo


def create_app(labeler, shared_secret: str, photo_reader: Optional[object] = None) -> FastAPI:
    app = FastAPI(title="Flora LLM backend")

    def require_secret(x_flora_secret: str = Header(default="")) -> None:
        if not hmac.compare_digest(x_flora_secret, shared_secret):
            raise HTTPException(status_code=401, detail="bad or missing X-Flora-Secret")

    @app.post("/label", response_model=LabelResponse, dependencies=[Depends(require_secret)])
    def label(request: LabelRequest) -> LabelResponse:
        return label_session(request, labeler)

    @app.post("/photo-check", response_model=PhotoCheckResponse,
              dependencies=[Depends(require_secret)])
    def photo_check(request: PhotoCheckRequest) -> PhotoCheckResponse:
        return check_photo(request, photo_reader)

    return app
