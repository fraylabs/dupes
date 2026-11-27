# Runs inside the app's own shell (manage.py shell). Makes the first login, one
# organisation, its projects and one read-only token, and prints them once as JSON.
# Safe to run again: existing rows are reused and no password is reset.
# All or nothing: if any step fails, nothing is saved, so a password is never made and lost.
import json, os, secrets
from django.apps import apps
from django.db import transaction

User = apps.get_model("users", "User")
Organization = apps.get_model("organizations_ext", "Organization")
OrganizationUser = apps.get_model("organizations_ext", "OrganizationUser")
OrganizationOwner = apps.get_model("organizations_ext", "OrganizationOwner")
Project = apps.get_model("projects", "Project")
ProjectKey = apps.get_model("projects", "ProjectKey")
APIToken = apps.get_model("api_tokens", "APIToken")


def main():
    with transaction.atomic():
        email = os.environ["ADMIN_EMAIL"]
        org_name = os.environ["ORG_NAME"]
        project_names = [n.strip() for n in os.environ["PROJECTS"].split(",") if n.strip()]
        out = {"adminEmail": email}

        user = User.objects.filter(email=email).first()
        if user is None:
            password = secrets.token_urlsafe(18)
            user = User.objects.create_superuser(email=email, password=password)
            out["adminPassword"] = password

        org, _ = Organization.objects.get_or_create(slug=org_name, defaults={"name": org_name})
        role_field = OrganizationUser._meta.get_field("role")
        owner_role = max(value for value, _label in role_field.choices)
        member, _ = OrganizationUser.objects.get_or_create(
            user=user, organization=org, defaults={"role": owner_role}
        )
        OrganizationOwner.objects.get_or_create(organization=org, defaults={"organization_user": member})
        out["organization"] = org.slug

        out["projects"] = {}
        for name in project_names:
            project, _ = Project.objects.get_or_create(
                organization=org, slug=name, defaults={"name": name}
            )
            key = ProjectKey.objects.filter(project=project).first() or ProjectKey.objects.create(
                project=project
            )
            out["projects"][name] = {
                "id": project.id,
                "publicKey": key.public_key.hex if hasattr(key.public_key, "hex") else str(key.public_key),
                "dsn": key.get_dsn(),
            }

        label = "agents-read"
        if not APIToken.objects.filter(user=user, label=label).exists():
            flags = list(APIToken._meta.get_field("scopes").flags)
            wanted = {"project:read", "org:read", "event:read", "team:read", "member:read"}
            missing = wanted - set(flags)
            if missing:
                raise SystemExit("scopes not offered by this version: %s of %s" % (sorted(missing), flags))
            bits = sum(1 << i for i, flag in enumerate(flags) if flag in wanted)
            token = APIToken.objects.create(user=user, label=label, scopes=bits)
            out["agentToken"] = token.token

        return out


print("RESULT " + json.dumps(main()))
