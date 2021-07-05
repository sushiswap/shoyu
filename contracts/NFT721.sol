// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "./interfaces/INFT721.sol";
import "./base/BaseNFT721.sol";
import "./base/BaseNFTExchange.sol";
import "./factories/ProxyFactory.sol";
import "./NFT721GovernanceToken.sol";

contract NFT721 is BaseNFT721, BaseNFTExchange, ProxyFactory, INFT721 {
    event Liquidate(address indexed proxy, uint256 indexed tokenId, uint8 minimumQuorum);

    address internal _royaltyFeeRecipient;
    uint8 internal _royaltyFee; // out of 1000

    address internal _target;

    function initialize(
        string memory _baseURI_,
        string memory _name,
        string memory _symbol,
        address _owner,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external initializer {
        initialize(_baseURI_, _name, _symbol, _owner);

        setRoyaltyFeeRecipient(royaltyFeeRecipient);
        setRoyaltyFee(royaltyFee);

        NFT721GovernanceToken token = new NFT721GovernanceToken();
        token.initialize(0, 0);
        _target = address(token);
    }

    function DOMAIN_SEPARATOR() public view override(BaseNFT721, BaseNFTExchange, INFT721) returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function factory() public view override(BaseNFT721, BaseNFTExchange, INFT721) returns (address) {
        return _factory;
    }

    function royaltyFeeInfo() public view override(BaseNFTExchange, INFT721) returns (address recipient, uint8 permil) {
        return (_royaltyFeeRecipient, _royaltyFee);
    }

    function _transfer(
        address,
        address from,
        address to,
        uint256 tokenId,
        uint256
    ) internal override {
        _transfer(from, to, tokenId);
    }

    function submitOrder(
        uint256 tokenId,
        uint256 amount,
        address strategy,
        address currency,
        uint256 deadline,
        bytes memory params
    ) external override {
        bytes32 hash = _submitOrder(address(this), tokenId, amount, strategy, currency, deadline, params);

        emit SubmitOrder(hash);
    }

    function setRoyaltyFeeRecipient(address royaltyFeeRecipient) public override onlyOwner {
        require(royaltyFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _royaltyFeeRecipient = royaltyFeeRecipient;
    }

    function setRoyaltyFee(uint8 royaltyFee) public override onlyOwner {
        require(royaltyFee <= INFTFactory(_factory).MAX_ROYALTY_FEE(), "SHOYU: INVALID_FEE");

        _royaltyFee = royaltyFee;
    }

    function liquidate(uint256 tokenId, uint8 _minimumQuorum) external override returns (address proxy) {
        bytes memory initData = abi.encodeWithSignature("initialize(uint256,uint8)", tokenId, _minimumQuorum);
        proxy = _createProxy(_target, initData);

        _transfer(msg.sender, proxy, tokenId);

        emit Liquidate(proxy, tokenId, _minimumQuorum);
    }
}
