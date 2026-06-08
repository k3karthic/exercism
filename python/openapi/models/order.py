from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Order")


@_attrs_define
class Order:
    """
    Attributes:
        id (int | None | Unset):
        pet_id (int | None | Unset):
        quantity (int | None | Unset):
        ship_date (datetime.datetime | None | Unset):
        status (None | str | Unset):
        complete (bool | Unset):  Default: False.
    """

    id: int | None | Unset = UNSET
    pet_id: int | None | Unset = UNSET
    quantity: int | None | Unset = UNSET
    ship_date: datetime.datetime | None | Unset = UNSET
    status: None | str | Unset = UNSET
    complete: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id: int | None | Unset
        if isinstance(self.id, Unset):
            id = UNSET
        else:
            id = self.id

        pet_id: int | None | Unset
        if isinstance(self.pet_id, Unset):
            pet_id = UNSET
        else:
            pet_id = self.pet_id

        quantity: int | None | Unset
        if isinstance(self.quantity, Unset):
            quantity = UNSET
        else:
            quantity = self.quantity

        ship_date: None | str | Unset
        if isinstance(self.ship_date, Unset):
            ship_date = UNSET
        elif isinstance(self.ship_date, datetime.datetime):
            ship_date = self.ship_date.isoformat()
        else:
            ship_date = self.ship_date

        status: None | str | Unset
        if isinstance(self.status, Unset):
            status = UNSET
        else:
            status = self.status

        complete = self.complete

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if id is not UNSET:
            field_dict["id"] = id
        if pet_id is not UNSET:
            field_dict["pet_id"] = pet_id
        if quantity is not UNSET:
            field_dict["quantity"] = quantity
        if ship_date is not UNSET:
            field_dict["ship_date"] = ship_date
        if status is not UNSET:
            field_dict["status"] = status
        if complete is not UNSET:
            field_dict["complete"] = complete

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_id(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        id = _parse_id(d.pop("id", UNSET))

        def _parse_pet_id(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        pet_id = _parse_pet_id(d.pop("pet_id", UNSET))

        def _parse_quantity(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        quantity = _parse_quantity(d.pop("quantity", UNSET))

        def _parse_ship_date(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                ship_date_type_0 = datetime.datetime.fromisoformat(data)

                return ship_date_type_0
            except TypeError, ValueError, AttributeError, KeyError:
                pass
            return cast(datetime.datetime | None | Unset, data)

        ship_date = _parse_ship_date(d.pop("ship_date", UNSET))

        def _parse_status(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        status = _parse_status(d.pop("status", UNSET))

        complete = d.pop("complete", UNSET)

        order = cls(
            id=id,
            pet_id=pet_id,
            quantity=quantity,
            ship_date=ship_date,
            status=status,
            complete=complete,
        )

        order.additional_properties = d
        return order

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
