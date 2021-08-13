// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/IBaseNFT721.sol";
import "./interfaces/IBaseNFT1155.sol";
import "./base/ProxyFactory.sol";
import "./ERC721ExchangeV0.sol";
import "./ERC1155ExchangeV0.sol";

contract TokenFactory is ProxyFactory, Ownable, ITokenFactory {
    uint8 public constant override MAX_ROYALTY_FEE = 250; // 25%
    uint8 public constant override MAX_OPERATIONAL_FEE = 50; // 5%

    address[] internal _targets721;
    address[] internal _targets1155;
    address[] internal _targetsSocialToken;

    address internal _protocolFeeRecipient;
    uint8 internal _protocolFee; // out of 1000
    address internal _operationalFeeRecipient;
    uint8 internal _operationalFee; // out of 1000

    string public override baseURI721;
    string public override baseURI1155;

    address public override erc721Exchange;
    address public override erc1155Exchange;
    // any account can deploy proxies if isDeployerWhitelisted[0x0000000000000000000000000000000000000000] == true
    mapping(address => bool) public override isDeployerWhitelisted;
    mapping(address => bool) public override isStrategyWhitelisted;

    mapping(address => mapping(uint256 => uint256)) public tagNonces;

    modifier onlyDeployer {
        require(isDeployerWhitelisted[address(0)] || isDeployerWhitelisted[msg.sender], "SHOYU: FORBIDDEN");
        _;
    }

    constructor(
        address protocolFeeRecipient,
        uint8 protocolFee,
        address operationalFeeRecipient,
        uint8 operationalFee,
        string memory _baseURI721,
        string memory _baseURI1155
    ) {
        _protocolFeeRecipient = protocolFeeRecipient;
        _protocolFee = protocolFee;
        _operationalFeeRecipient = operationalFeeRecipient;
        _operationalFee = operationalFee;

        baseURI721 = _baseURI721;
        baseURI1155 = _baseURI1155;
    }

    function protocolFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_protocolFeeRecipient, _protocolFee);
    }

    function operationalFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_operationalFeeRecipient, _operationalFee);
    }

    function setBaseURI721(string memory uri) external override onlyOwner {
        baseURI721 = uri;
    }

    function setBaseURI1155(string memory uri) external override onlyOwner {
        baseURI1155 = uri;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setProtocolFeeRecipient(address protocolFeeRecipient) external override onlyOwner {
        require(protocolFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _protocolFeeRecipient = protocolFeeRecipient;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setOperationalFeeRecipient(address operationalFeeRecipient) external override onlyOwner {
        require(operationalFeeRecipient != address(0), "SHOYU: INVALID_RECIPIENT");

        _operationalFeeRecipient = operationalFeeRecipient;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setOperationalFee(uint8 operationalFee) external override onlyOwner {
        require(operationalFee <= MAX_OPERATIONAL_FEE, "SHOYU: INVALID_FEE");

        _operationalFee = operationalFee;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setDeployerWhitelisted(address deployer, bool whitelisted) external override onlyOwner {
        require(deployer != address(0), "SHOYU: INVALID_ADDRESS");

        isDeployerWhitelisted[deployer] = whitelisted;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setStrategyWhitelisted(address strategy, bool whitelisted) external override onlyOwner {
        require(strategy != address(0), "SHOYU: INVALID_ADDRESS");

        isStrategyWhitelisted[strategy] = whitelisted;
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeNFT721(address newTarget) external override onlyOwner {
        _targets721.push(newTarget);

        emit UpgradeNFT721(newTarget);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeNFT1155(address newTarget) external override onlyOwner {
        _targets1155.push(newTarget);

        emit UpgradeNFT1155(newTarget);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeSocialToken(address newTarget) external override onlyOwner {
        _targetsSocialToken.push(newTarget);

        emit UpgradeSocialToken(newTarget);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeERC721Exchange(address exchange) external override onlyOwner {
        erc721Exchange = exchange;

        emit UpgradeERC721Exchange(exchange);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeERC1155Exchange(address exchange) external override onlyOwner {
        erc1155Exchange = exchange;

        emit UpgradeERC1155Exchange(exchange);
    }

    function deployNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint256[] memory tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override onlyDeployer returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");

        nft = _createProxy(
            _targets721[_targets721.length - 1],
            abi.encodeWithSignature(
                "initialize(string,string,address,uint256[],address,uint8)",
                name,
                symbol,
                owner,
                tokenIds,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit DeployNFT721(nft, name, symbol, owner, tokenIds, royaltyFeeRecipient, royaltyFee);
    }

    function deployNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override onlyDeployer returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");

        nft = _createProxy(
            _targets721[_targets721.length - 1],
            abi.encodeWithSignature(
                "initialize(string,string,address,uint256,address,uint8)",
                name,
                symbol,
                owner,
                toTokenId,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit DeployNFT721(nft, name, symbol, owner, toTokenId, royaltyFeeRecipient, royaltyFee);
    }

    function isNFT721(address query) external view override returns (bool result) {
        for (uint256 i = _targets721.length - 1; i >= 0; i--) {
            if (_isProxy(_targets721[i], query)) {
                return true;
            }
        }
        return false;
    }

    function deployNFT1155(
        address owner,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override onlyDeployer returns (address nft) {
        nft = _createProxy(
            _targets1155[_targets1155.length - 1],
            abi.encodeWithSignature(
                "initialize(address,uint256[],uint256[],address,uint8)",
                owner,
                tokenIds,
                amounts,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit DeployNFT1155(nft, owner, tokenIds, amounts, royaltyFeeRecipient, royaltyFee);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        for (uint256 i = _targets1155.length - 1; i >= 0; i--) {
            if (_isProxy(_targets1155[i], query)) {
                return true;
            }
        }
        return false;
    }

    function deploySocialToken(
        address owner,
        string memory name,
        string memory symbol,
        address dividendToken
    ) external override onlyDeployer returns (address proxy) {
        bytes memory initData =
            abi.encodeWithSignature("initialize(address,string,string,address)", owner, name, symbol, dividendToken);
        proxy = _createProxy(_targetsSocialToken[_targetsSocialToken.length - 1], initData);

        emit DeploySocialToken(proxy, owner, name, symbol, dividendToken);
    }

    function isSocialToken(address query) external view override returns (bool result) {
        for (uint256 i = _targetsSocialToken.length - 1; i >= 0; i--) {
            if (_isProxy(_targetsSocialToken[i], query)) {
                return true;
            }
        }
        return false;
    }

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        bytes memory data,
        string[] memory tags
    ) external override {
        _setTags(nft, tokenId, tags);
        IBaseNFT721(nft).mint(to, tokenId, data);
    }

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory data,
        string[] memory tags
    ) external override {
        _setTags(nft, tokenId, tags);
        IBaseNFT1155(nft).mint(to, tokenId, amount, data);
    }

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(IBaseNFT721(nft).ownerOf(tokenId) == msg.sender, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external override {
        require(IBaseNFT1155(nft).balanceOf(msg.sender, tokenId) > 0, "SHOYU: FORBIDDEN");
        _setTags(nft, tokenId, tags);
    }

    function _setTags(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) internal {
        uint256 nonce = tagNonces[nft][tokenId]++;

        for (uint256 i; i < tags.length; i++) {
            emit Tag(nft, tokenId, tags[i], nonce);
        }
    }
}
