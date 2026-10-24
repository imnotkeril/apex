"""Unit tests for Settings -> Team & Access (GET/PATCH /orgs/current/users/*).

Exercises the endpoint functions directly against a fake AsyncSession so no
real database is required — mirrors the style of test_publish_and_automode.py.
"""

import uuid

import pytest
from fastapi import HTTPException

from app.api.v1.orgs import TeamMemberUpdate, list_org_team, update_org_team_member
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.user import User
from tests._fakes import FakeResult, FakeSession

ORG_ID = uuid.uuid4()


def _user(role: str, **kw) -> User:
    u = User(
        id=uuid.uuid4(),
        auth_id=uuid.uuid4(),
        org_id=ORG_ID,
        email=kw.pop("email", "user@apex.local"),
        full_name=kw.pop("full_name", "Some User"),
        role=role,
        is_active=kw.pop("is_active", True),
    )
    for k, v in kw.items():
        setattr(u, k, v)
    return u


@pytest.mark.asyncio
async def test_list_org_team_returns_users_in_org():
    members = [_user("admin"), _user("editor")]
    db = FakeSession([FakeResult(items=members)])
    actor = members[0]
    out = await list_org_team(db, actor)
    assert out == members


@pytest.mark.asyncio
async def test_patch_requires_admin_role_403():
    actor = _user("editor")
    target = _user("viewer")
    db = FakeSession([])  # no query should even run before the permission check
    with pytest.raises(PermissionDeniedException):
        await update_org_team_member(target.id, TeamMemberUpdate(role="admin"), db, actor)


@pytest.mark.asyncio
async def test_patch_owner_role_is_treated_as_admin():
    """Dev-bypass / org-creator users get role='owner' — they must still manage the team."""
    actor = _user("owner")
    target = _user("viewer")
    db = FakeSession([FakeResult(items=[target])])
    updated = await update_org_team_member(target.id, TeamMemberUpdate(role="editor"), db, actor)
    assert updated.role == "editor"


@pytest.mark.asyncio
async def test_patch_404_for_user_outside_org():
    actor = _user("admin")
    db = FakeSession([FakeResult(items=[])])  # query filtered by org_id finds nothing
    with pytest.raises(ResourceNotFoundException):
        await update_org_team_member(uuid.uuid4(), TeamMemberUpdate(is_active=False), db, actor)


@pytest.mark.asyncio
async def test_patch_self_demote_returns_400():
    actor = _user("admin")
    db = FakeSession([FakeResult(items=[actor])])  # target == actor
    with pytest.raises(HTTPException) as exc_info:
        await update_org_team_member(actor.id, TeamMemberUpdate(role="editor"), db, actor)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_patch_self_deactivate_returns_400():
    actor = _user("admin")
    db = FakeSession([FakeResult(items=[actor])])
    with pytest.raises(HTTPException) as exc_info:
        await update_org_team_member(actor.id, TeamMemberUpdate(is_active=False), db, actor)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_patch_self_reaffirming_admin_role_is_allowed():
    actor = _user("admin")
    db = FakeSession([FakeResult(items=[actor])])
    updated = await update_org_team_member(actor.id, TeamMemberUpdate(role="admin"), db, actor)
    assert updated.role == "admin"


@pytest.mark.asyncio
async def test_patch_admin_can_change_another_member_role_and_deactivate():
    actor = _user("admin")
    target = _user("editor")
    db = FakeSession([FakeResult(items=[target])])
    updated = await update_org_team_member(
        target.id, TeamMemberUpdate(role="viewer", is_active=False), db, actor
    )
    assert updated.role == "viewer"
    assert updated.is_active is False
