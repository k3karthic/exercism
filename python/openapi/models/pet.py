from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Pet")


@_attrs_define
class Pet:
    """
    Attributes:
        name (str):
        id (int | None | Unset):
        photo_urls (Any | Unset):
        category (Any | Unset):
        tags (list[str] | Unset):
        status (None | str | Unset):
    """

    name: str
    id: int | None | Unset = UNSET
    photo_urls: Any | Unset = UNSET
    category: Any | Unset = UNSET
    tags: list[str] | Unset = UNSET
    status: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        id: int | None | Unset
        if isinstance(self.id, Unset):
            id = UNSET
        else:
            id = self.id

        photo_urls = self.photo_urls

        category = self.category

        tags: list[str] | Unset = UNSET
        if not isinstance(self.tags, Unset):
            tags = self.tags

        status: None | str | Unset
        if isinstance(self.status, Unset):
            status = UNSET
        else:
            status = self.status

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
            }
        )
        if id is not UNSET:
            field_dict["id"] = id
        if photo_urls is not UNSET:
            field_dict["photoUrls"] = photo_urls
        if category is not UNSET:
            field_dict["category"] = category
        if tags is not UNSET:
            field_dict["tags"] = tags
        if status is not UNSET:
            field_dict["status"] = status

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        def _parse_id(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        id = _parse_id(d.pop("id", UNSET))

        photo_urls = d.pop("photoUrls", UNSET)

        category = d.pop("category", UNSET)

        tags = cast(list[str], d.pop("tags", UNSET))

        def _parse_status(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        status = _parse_status(d.pop("status", UNSET))

        pet = cls(
            name=name,
            id=id,
            photo_urls=photo_urls,
            category=category,
            tags=tags,
            status=status,
        )

        pet.additional_properties = d
        return pet

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
