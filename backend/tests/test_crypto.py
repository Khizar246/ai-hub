# Credential encryption round-trip and failure modes.

from core import crypto


class TestCryptoRoundTrip:
    def test_dict_round_trip(self):
        payload = {"host": "db.example.com", "password": "s3cret!", "port": "5432"}
        token = crypto.encrypt_json(payload)
        assert isinstance(token, str)
        assert "s3cret!" not in token  # ciphertext never contains the plaintext
        assert crypto.decrypt_json(token) == payload

    def test_garbage_returns_none(self):
        assert crypto.decrypt_json("not-a-fernet-token") is None

    def test_legacy_plaintext_dict_returns_none(self):
        # Values stored before encryption was added come back as dicts from
        # the JSON session store — decrypt must not blow up on them.
        assert crypto.decrypt_json({"host": "x", "password": "y"}) is None

    def test_none_and_empty_return_none(self):
        assert crypto.decrypt_json(None) is None
        assert crypto.decrypt_json("") is None
