from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ResourceNotFoundException
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter()


@router.get("/", response_model=list[CompanyRead])
async def list_companies(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> list[Company]:
    result = await db.execute(select(Company).where(Company.org_id == current_user.org_id).order_by(Company.name))
    return list(result.scalars().all())


@router.post("/", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(
    body: CompanyCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Company:
    data = body.model_dump()
    company = Company(org_id=current_user.org_id, **data)
    db.add(company)
    await db.flush()
    await db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(
    company_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Company:
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.org_id == current_user.org_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise ResourceNotFoundException("Company", str(company_id))
    return company


@router.patch("/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: UUID,
    body: CompanyUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> Company:
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.org_id == current_user.org_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise ResourceNotFoundException("Company", str(company_id))
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    await db.flush()
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.org_id == current_user.org_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise ResourceNotFoundException("Company", str(company_id))
    await db.execute(delete(Company).where(Company.id == company_id, Company.org_id == current_user.org_id))
